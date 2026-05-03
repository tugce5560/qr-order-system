import { useCallback, useEffect, useState } from "react";
import api from "../../services/api";
import {
  onOrderCreated,
  onOrderUpdated,
  startOrderHubConnection,
} from "../../services/orderHub";
import type { OrderEventPayload } from "../../services/orderHub";
import "./CustomerOrdersPage.css";

type OrderItem = {
  id: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  note?: string | null;
};

type CustomerOrder = {
  id: number;
  orderNumber: string;
  tableId: number;
  status: "New" | "Preparing" | "Ready" | "Served" | "Paid" | "Cancelled";
  totalAmount: number;
  createdAt?: string;
  items: OrderItem[];
};

function getCurrentTableId() {
  return Number(sessionStorage.getItem("customerTableId")) || 1;
}

function getCurrentTableNumber() {
  return sessionStorage.getItem("customerTableNumber") || "1";
}

function formatCreatedTime(order: CustomerOrder) {
  if (order.createdAt) {
    return new Date(order.createdAt).toLocaleTimeString();
  }

  const match = order.orderNumber.match(
    /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/,
  );

  if (!match) {
    return "Not available";
  }

  const [, year, month, day, hour, minute, second] = match;
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  ).toLocaleTimeString();
}

function CustomerOrdersPage() {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tableId = getCurrentTableId();

  const mergeRealtimeOrder = useCallback(
    (orderEvent: OrderEventPayload) => {
      if (orderEvent.tableId !== tableId) {
        return;
      }

      const realtimeOrder: CustomerOrder = {
        id: orderEvent.id ?? orderEvent.orderId,
        orderNumber: orderEvent.orderNumber,
        tableId: orderEvent.tableId,
        status: orderEvent.status as CustomerOrder["status"],
        totalAmount: orderEvent.totalAmount,
        createdAt: orderEvent.createdAt,
        items: orderEvent.items ?? [],
      };

      setOrders((currentOrders) => {
        const existingOrder = currentOrders.some(
          (order) => order.id === realtimeOrder.id,
        );

        if (!existingOrder) {
          return [realtimeOrder, ...currentOrders];
        }

        return currentOrders.map((order) =>
          order.id === realtimeOrder.id ? realtimeOrder : order,
        );
      });
    },
    [tableId],
  );

  const loadOrders = useCallback(async () => {
    try {
      setError(null);

      const response = await api.get<CustomerOrder[]>("/orders", {
        params: { tableId },
      });

      setOrders(response.data.filter((order) => order.tableId === tableId));
    } catch {
      setError("Orders could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }, [tableId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadOrders();
    }, 0);

    const intervalId = window.setInterval(() => {
      loadOrders();
    }, 10000);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [loadOrders]);

  useEffect(() => {
    startOrderHubConnection();

    const unsubscribeCreated = onOrderCreated(mergeRealtimeOrder);
    const unsubscribeUpdated = onOrderUpdated(mergeRealtimeOrder);

    return () => {
      unsubscribeCreated();
      unsubscribeUpdated();
    };
  }, [mergeRealtimeOrder]);

  function toggleOrder(orderId: number) {
    setExpandedOrderId((currentOrderId) =>
      currentOrderId === orderId ? null : orderId,
    );
  }

  return (
    <main className="customer-orders-page">
      <header className="orders-header">
        <p>My Orders</p>
        <h1>Table {getCurrentTableNumber()}</h1>
      </header>

      {isLoading && <p className="orders-message">Loading orders...</p>}
      {error && <p className="orders-message orders-error">{error}</p>}

      {!isLoading && orders.length === 0 && (
        <p className="orders-empty">No orders found for this table.</p>
      )}

      <section className="orders-list">
        {orders.map((order) => (
          <article className="order-card" key={order.id}>
            <button type="button" onClick={() => toggleOrder(order.id)}>
              <span>
                <strong>Order {order.orderNumber}</strong>
                <small>{formatCreatedTime(order)}</small>
              </span>
              <span className={`order-status status-${order.status.toLowerCase()}`}>
                {order.status}
              </span>
            </button>

            <div className="order-summary">
              <span>Total</span>
              <strong>₺{order.totalAmount}</strong>
            </div>

            {expandedOrderId === order.id && (
              <div className="order-detail">
                {order.items.map((item) => (
                  <div className="order-line" key={item.id}>
                    <span>
                      {item.productName} x {item.quantity}
                      {item.note && (
                        <small className="order-line-note">{item.note}</small>
                      )}
                    </span>
                    <strong>₺{item.unitPrice * item.quantity}</strong>
                  </div>
                ))}
              </div>
            )}
          </article>
        ))}
      </section>
    </main>
  );
}

export default CustomerOrdersPage
