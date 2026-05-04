import { useEffect, useMemo, useState } from "react";
import { api } from "../../services/api";
import {
  onOrderCreated,
  onOrderUpdated,
  startOrderHubConnection,
} from "../../services/orderHub";
import type { OrderEventPayload } from "../../services/orderHub";
import {
  getDemoOrders,
  subscribeDemoOrders,
  updateDemoOrderStatus,
  type DemoOrder,
} from "../../services/demoRealtime";
import "./KitchenBoardPage.css";

type OrderItem = {
  id: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  note?: string | null;
  removedIngredients?: string | null;
};

type Order = {
  id: number;
  orderNumber: string;
  tableId: number;
  status: string;
  totalAmount: number;
  createdAt?: string;
  items: OrderItem[];
};

type KitchenStatus = "New" | "Preparing" | "Ready" | "Served";

type FilterOption = {
  status: KitchenStatus;
  label: string;
  description: string;
};

const filterOptions: FilterOption[] = [
  {
    status: "New",
    label: "Yeni Siparişler",
    description: "Mutfak ekranına yeni düşenler",
  },
  {
    status: "Preparing",
    label: "Hazırlanıyor",
    description: "Üretimde olan siparişler",
  },
  {
    status: "Ready",
    label: "Hazır",
    description: "Servise çıkmayı bekleyenler",
  },
  {
    status: "Served",
    label: "Tamamlandı",
    description: "Teslim edilmiş siparişler",
  },
];

const statusLabels: Record<KitchenStatus, string> = {
  New: "Yeni Sipariş",
  Preparing: "Hazırlanıyor",
  Ready: "Hazır",
  Served: "Tamamlandı",
};

const demoKitchenOrders: Order[] = [
  {
    id: 9201,
    orderNumber: "DEMO-201",
    tableId: 1,
    status: "New",
    totalAmount: 390,
    createdAt: new Date().toISOString(),
    items: [
      { id: 1, productName: "Classic Burger", quantity: 1, unitPrice: 245, note: "Soğansız" },
      { id: 2, productName: "Limonata", quantity: 1, unitPrice: 145 },
    ],
  },
  {
    id: 9202,
    orderNumber: "DEMO-202",
    tableId: 2,
    status: "Preparing",
    totalAmount: 420,
    createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    items: [
      { id: 3, productName: "Izgara Tavuk", quantity: 1, unitPrice: 320 },
      { id: 4, productName: "Ayran", quantity: 2, unitPrice: 50 },
    ],
  },
  {
    id: 9203,
    orderNumber: "DEMO-203",
    tableId: 4,
    status: "Ready",
    totalAmount: 285,
    createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    items: [
      { id: 5, productName: "Karışık Pizza", quantity: 1, unitPrice: 285, removedIngredients: "Mantar" },
    ],
  },
];

function isKitchenStatus(status: string): status is KitchenStatus {
  return ["New", "Preparing", "Ready", "Served"].includes(status);
}

function getStatusLabel(status: string) {
  return isKitchenStatus(status) ? statusLabels[status] : status;
}

function demoOrderToKitchenOrder(order: DemoOrder): Order {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    tableId: order.tableId,
    status: order.status,
    totalAmount: order.totalAmount,
    createdAt: order.createdAt,
    items: order.items.map((item) => ({
      id: item.id,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      note: item.note,
      removedIngredients: item.removedIngredients,
    })),
  };
}

function mergeOrdersWithDemo(orders: Order[]) {
  const demoOrders = getDemoOrders()
    .filter((order) => isKitchenStatus(order.status))
    .map(demoOrderToKitchenOrder);
  const orderIds = new Set(demoOrders.map((order) => order.id));

  return [
    ...demoOrders,
    ...orders.filter((order) => !orderIds.has(order.id)),
  ];
}

function getCreatedAtTime(order: Order) {
  if (!order.createdAt) {
    return 0;
  }

  const createdAtTime = new Date(order.createdAt).getTime();

  return Number.isNaN(createdAtTime) ? 0 : createdAtTime;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function KitchenBoardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeFilter, setActiveFilter] = useState<KitchenStatus>("New");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  const visibleOrders = useMemo(() => {
    return orders
      .filter((order) => order.status === activeFilter)
      .sort((firstOrder, secondOrder) => {
        if (firstOrder.status === "New" && secondOrder.status !== "New") {
          return -1;
        }

        if (firstOrder.status !== "New" && secondOrder.status === "New") {
          return 1;
        }

        return getCreatedAtTime(secondOrder) - getCreatedAtTime(firstOrder);
      });
  }, [activeFilter, orders]);

  const countsByStatus = useMemo(
    () =>
      filterOptions.reduce<Record<KitchenStatus, number>>((counts, option) => {
        counts[option.status] = orders.filter(
          (order) => order.status === option.status,
        ).length;
        return counts;
      }, {} as Record<KitchenStatus, number>),
    [orders],
  );

  const activeOrdersCount = orders.filter((order) =>
    ["New", "Preparing", "Ready"].includes(order.status),
  ).length;

  const urgentOrdersCount = orders.filter(
    (order) => order.status !== "Served" && getOrderAgeInMinutes(order) >= 12,
  ).length;

  async function fetchOrders() {
    try {
      setIsLoading(true);
      setError(null);

      const response = await api.get<Order[]>("/orders");
      setOrders(
        mergeOrdersWithDemo(
          response.data.filter((order) => isKitchenStatus(order.status)),
        ),
      );
    } catch {
      setError(null);
      setOrders(mergeOrdersWithDemo(demoKitchenOrders));
    } finally {
      setIsLoading(false);
    }
  }

  async function updateOrderStatus(orderId: number, status: KitchenStatus) {
    try {
      setUpdatingOrderId(orderId);
      await api.patch(`/orders/${orderId}/status`, {
        status,
      });

      await fetchOrders();
    } catch {
      setError(null);
      updateDemoOrderStatus(orderId, status);
      setOrders((currentOrders) =>
        currentOrders.map((order) =>
          order.id === orderId ? { ...order, status } : order,
        ),
      );
    } finally {
      setUpdatingOrderId(null);
    }
  }

  function mergeRealtimeOrder(orderEvent: OrderEventPayload) {
    if (!isKitchenStatus(orderEvent.status)) {
      setOrders((currentOrders) =>
        currentOrders.filter(
          (order) => order.id !== (orderEvent.id ?? orderEvent.orderId),
        ),
      );
      return;
    }

    const realtimeOrder: Order = {
      id: orderEvent.id ?? orderEvent.orderId,
      orderNumber: orderEvent.orderNumber,
      tableId: orderEvent.tableId,
      status: orderEvent.status,
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
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchOrders();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    return subscribeDemoOrders((demoOrders) => {
      setOrders((currentOrders) =>
        mergeOrdersWithDemo([
          ...currentOrders.filter(
            (order) => !demoOrders.some((demoOrder) => demoOrder.id === order.id),
          ),
        ]),
      );
    });
  }, []);

  useEffect(() => {
    startOrderHubConnection();

    const unsubscribeOrderCreated = onOrderCreated(mergeRealtimeOrder);
    const unsubscribeOrderUpdated = onOrderUpdated(mergeRealtimeOrder);

    return () => {
      unsubscribeOrderCreated();
      unsubscribeOrderUpdated();
    };
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000);

    return () => window.clearInterval(intervalId);
  }, []);

  function getOrderAgeInMinutes(order: Order) {
    const createdAtTime = getCreatedAtTime(order);

    if (createdAtTime === 0) {
      return 0;
    }

    return Math.max(0, Math.floor((currentTime - createdAtTime) / 60000));
  }

  function getOrderAgeLabel(order: Order) {
    const minutesAgo = getOrderAgeInMinutes(order);

    if (!order.createdAt) {
      return "Saat bilgisi yok";
    }

    if (minutesAgo < 1) {
      return "Az önce";
    }

    return `${minutesAgo} dk önce`;
  }

  function getOrderTimeLabel(order: Order) {
    if (!order.createdAt) {
      return "Saat bilgisi yok";
    }

    return new Intl.DateTimeFormat("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(order.createdAt));
  }

  function getTableNumber(order: Order) {
    const tableMatch = order.orderNumber.match(/#?T(\d+)/i);
    return tableMatch ? tableMatch[1] : String(order.tableId);
  }

  function getItemCount(order: Order) {
    return order.items.reduce((total, item) => total + item.quantity, 0);
  }

  function getNextAction(order: Order) {
    if (order.status === "New") {
      return {
        label: "Hazırlanmaya Başla",
        nextStatus: "Preparing" as const,
      };
    }

    if (order.status === "Preparing") {
      return {
        label: "Hazır Olarak İşaretle",
        nextStatus: "Ready" as const,
      };
    }

    if (order.status === "Ready") {
      return {
        label: "Tamamlandı",
        nextStatus: "Served" as const,
      };
    }

    return null;
  }

  function getOrderCardClassName(order: Order) {
    const classNames = [
      "kitchen-order-card",
      `kitchen-order-card-${order.status.toLowerCase()}`,
    ];
    const orderAge = getOrderAgeInMinutes(order);

    if (order.status === "New") {
      classNames.push("is-new");
    }

    if (order.status !== "Served" && orderAge >= 20) {
      classNames.push("is-critical");
    } else if (order.status !== "Served" && orderAge >= 12) {
      classNames.push("is-urgent");
    }

    return classNames.join(" ");
  }

  if (isLoading) {
    return (
      <main className="kitchen-shell">
        <section className="kitchen-hero kitchen-hero-loading">
          <div>
            <p className="kitchen-eyebrow">Canlı mutfak akışı</p>
            <h1>Mutfak Paneli</h1>
          </div>
          <span className="kitchen-live-pill">Yükleniyor</span>
        </section>

        <section className="kitchen-skeleton-grid" aria-label="Siparişler yükleniyor">
          {[1, 2, 3, 4].map((item) => (
            <div className="kitchen-skeleton-card" key={item} />
          ))}
        </section>
      </main>
    );
  }

  if (error) {
    return (
      <main className="kitchen-shell">
        <section className="kitchen-state-card kitchen-state-error">
          <span className="kitchen-state-mark">!</span>
          <h1>Bir şey ters gitti</h1>
          <p>{error}</p>
          <button type="button" onClick={fetchOrders}>
            Tekrar Dene
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="kitchen-shell">
      <section className="kitchen-hero">
        <div>
          <p className="kitchen-eyebrow">Canlı mutfak akışı</p>
          <h1>Mutfak Paneli</h1>
          <p className="kitchen-hero-copy">
            Yeni siparişler üstte, acil işler belirgin, durum aksiyonları tek
            dokunuşta.
          </p>
        </div>
        <div className="kitchen-hero-stats" aria-label="Mutfak özeti">
          <span>
            <strong>{activeOrdersCount}</strong>
            aktif sipariş
          </span>
          <span>
            <strong>{urgentOrdersCount}</strong>
            acil takip
          </span>
        </div>
      </section>

      <section className="kitchen-filter-bar" aria-label="Durum filtreleri">
        {filterOptions.map((option) => (
          <button
            className={activeFilter === option.status ? "is-active" : ""}
            key={option.status}
            type="button"
            onClick={() => setActiveFilter(option.status)}
          >
            <span>{option.label}</span>
            <strong>{countsByStatus[option.status] ?? 0}</strong>
          </button>
        ))}
      </section>

      <section className="kitchen-board-summary">
        <div>
          <h2>{filterOptions.find((option) => option.status === activeFilter)?.label}</h2>
          <p>
            {
              filterOptions.find((option) => option.status === activeFilter)
                ?.description
            }
          </p>
        </div>
        <time dateTime={new Date(currentTime).toISOString()}>
          Son kontrol {getOrderTimeLabel({ createdAt: new Date(currentTime).toISOString() } as Order)}
        </time>
      </section>

      {visibleOrders.length === 0 ? (
        <section className="kitchen-empty-state">
          <span className="kitchen-empty-icon">OK</span>
          <h2>Bu durumda sipariş yok</h2>
          <p>Yeni bir sipariş geldiğinde kart otomatik olarak burada görünecek.</p>
        </section>
      ) : (
        <section className="kitchen-order-grid" aria-label="Mutfak siparişleri">
          {visibleOrders.map((order) => {
            const nextAction = getNextAction(order);

            return (
              <article className={getOrderCardClassName(order)} key={order.id}>
                <div className="kitchen-order-card-header">
                  <div>
                    <span className="kitchen-table-chip">
                      Masa {getTableNumber(order)}
                    </span>
                    <h3>{order.orderNumber}</h3>
                  </div>
                  <span className="kitchen-status-chip">
                    {getStatusLabel(order.status)}
                  </span>
                </div>

                <dl className="kitchen-order-facts">
                  <div>
                    <dt>Sipariş saati</dt>
                    <dd>{getOrderTimeLabel(order)}</dd>
                  </div>
                  <div>
                    <dt>Geçen süre</dt>
                    <dd>{getOrderAgeLabel(order)}</dd>
                  </div>
                  <div>
                    <dt>Ürün adedi</dt>
                    <dd>{getItemCount(order)}</dd>
                  </div>
                </dl>

                <ul className="kitchen-order-items">
                  {order.items.map((item) => (
                    <li key={item.id}>
                      <div>
                        <span>{item.productName}</span>
                        {item.note && (
                          <small>Not: {item.note}</small>
                        )}
                        {item.removedIngredients && (
                          <small>Çıkarılanlar: {item.removedIngredients}</small>
                        )}
                      </div>
                      <strong>x{item.quantity}</strong>
                    </li>
                  ))}
                </ul>

                <footer className="kitchen-order-actions">
                  <span>{formatCurrency(order.totalAmount)}</span>
                  {nextAction ? (
                    <button
                      type="button"
                      onClick={() =>
                        updateOrderStatus(order.id, nextAction.nextStatus)
                      }
                      disabled={updatingOrderId === order.id}
                    >
                      {updatingOrderId === order.id
                        ? "Güncelleniyor"
                        : nextAction.label}
                    </button>
                  ) : (
                    <strong>Tamamlandı</strong>
                  )}
                </footer>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
