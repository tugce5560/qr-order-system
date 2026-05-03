import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../services/api";
import {
  onOrderCreated,
  onOrderUpdated,
  onServiceRequested,
  startOrderHubConnection,
} from "../../services/orderHub";
import type {
  OrderEventPayload,
  ServiceRequestPayload,
} from "../../services/orderHub";
import "./WaiterPage.css";

type WaiterTable = {
  tableId: number;
  tableNumber: number;
  activeOrderCount: number;
  totalAmount: number;
  status: string;
};

type WaiterOrderItem = {
  id: number;
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  note?: string | null;
  removedIngredients?: string | null;
};

type WaiterOrder = {
  id: number;
  orderNumber: string;
  tableId: number;
  status: OrderStatus;
  totalAmount: number;
  createdAt?: string;
  note?: string | null;
  items: WaiterOrderItem[];
};

type WaiterCall = {
  id: number;
  tableId: number;
  tableNumber: number;
  status: string;
  message?: string | null;
  createdAt: string;
};

type OrderStatus = "New" | "Preparing" | "Ready" | "Served" | "Paid";

const statusFilters: { status: OrderStatus; label: string }[] = [
  { status: "New", label: "Yeni Siparişler" },
  { status: "Preparing", label: "Hazırlanıyor" },
  { status: "Ready", label: "Hazır" },
  { status: "Served", label: "Servis Edildi" },
  { status: "Paid", label: "Ödendi" },
];

const visibleStatuses: OrderStatus[] = [
  "New",
  "Preparing",
  "Ready",
  "Served",
  "Paid",
];

type Product = {
  id: number;
  name: string;
  price: number;
  ingredients?: string | null;
  removableIngredients?: string | null;
};

type EditOrderItem = {
  productId: number;
  quantity: number;
  note?: string;
  removedIngredients?: string;
};

function WaiterPage() {
  const [tables, setTables] = useState<WaiterTable[]>([]);
  const [orders, setOrders] = useState<WaiterOrder[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus>("New");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);
  const [selectedBillOrder, setSelectedBillOrder] = useState<WaiterOrder | null>(
    null,
  );
  const [serviceRequests, setServiceRequests] = useState<
    ServiceRequestPayload[]
  >([]);
  const [waiterCalls, setWaiterCalls] = useState<WaiterCall[]>([]);
  const [editingOrder, setEditingOrder] = useState<WaiterOrder | null>(null);
  const [editItems, setEditItems] = useState<EditOrderItem[]>([]);
  const [editOrderNote, setEditOrderNote] = useState<string>("");
  const [products, setProducts] = useState<Product[]>([]);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const fetchWaiterData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [tablesResponse, ordersResponse] = await Promise.all([
        api.get<WaiterTable[]>("/waiter/tables"),
        api.get<WaiterOrder[]>("/orders"),
      ]);
      const callsResponse = await api.get<WaiterCall[]>("/waiter-calls");
      const productsResponse = await api.get<Product[]>("/admin/products");

      setTables(tablesResponse.data);
      setWaiterCalls(callsResponse.data);
      setProducts(productsResponse.data);
      setOrders(
        ordersResponse.data.filter((order) =>
          visibleStatuses.includes(order.status),
        ),
      );
    } catch {
      setError("Garson paneli verileri yüklenemedi.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const mergeRealtimeOrder = useCallback((orderEvent: OrderEventPayload) => {
    if (!visibleStatuses.includes(orderEvent.status as OrderStatus)) {
      setOrders((currentOrders) =>
        currentOrders.filter(
          (order) => order.id !== (orderEvent.id ?? orderEvent.orderId),
        ),
      );
      return;
    }

    const realtimeOrder: WaiterOrder = {
      id: orderEvent.id ?? orderEvent.orderId,
      orderNumber: orderEvent.orderNumber,
      tableId: orderEvent.tableId,
      status: orderEvent.status as OrderStatus,
      totalAmount: orderEvent.totalAmount,
      createdAt: orderEvent.createdAt,
      note: orderEvent.note,
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
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchWaiterData();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchWaiterData]);

  useEffect(() => {
    startOrderHubConnection();

    const unsubscribeOrderCreated = onOrderCreated(mergeRealtimeOrder);
    const unsubscribeOrderUpdated = onOrderUpdated(mergeRealtimeOrder);
    const unsubscribeServiceRequested = onServiceRequested((request) => {
      setServiceRequests((currentRequests) =>
        [
          request,
          ...currentRequests.filter(
            (currentRequest) =>
              !(
                currentRequest.tableId === request.tableId &&
                currentRequest.type === request.type
              ),
          ),
        ].slice(0, 8),
      );
    });

    return () => {
      unsubscribeOrderCreated();
      unsubscribeOrderUpdated();
      unsubscribeServiceRequested();
    };
  }, [mergeRealtimeOrder]);

  async function updateOrderStatus(orderId: number, status: OrderStatus) {
    try {
      setUpdatingOrderId(orderId);
      await api.patch(`/orders/${orderId}/status`, { status });
      await fetchWaiterData();
    } catch {
      setError("Sipariş durumu güncellenemedi.");
    } finally {
      setUpdatingOrderId(null);
    }
  }

  function openEditModal(order: WaiterOrder) {
    setEditingOrder(order);
    setEditItems(order.items.map(item => ({
      productId: item.productId,
      quantity: item.quantity,
      note: item.note || "",
      removedIngredients: item.removedIngredients || "",
    })));
    setEditOrderNote(order.note || "");
    setIsEditModalOpen(true);
  }

  function closeEditModal() {
    setEditingOrder(null);
    setEditItems([]);
    setEditOrderNote("");
    setIsEditModalOpen(false);
  }

  function updateEditItem(index: number, updates: Partial<EditOrderItem>) {
    setEditItems(currentItems =>
      currentItems.map((item, i) =>
        i === index
          ? {
              ...item,
              ...updates,
              quantity:
                updates.quantity === undefined
                  ? item.quantity
                  : Math.max(1, Number(updates.quantity) || 1),
            }
          : item,
      ),
    );
  }

  function removeEditItem(index: number) {
    setEditItems(currentItems => currentItems.filter((_, i) => i !== index));
  }

  function addEditItem() {
    if (products.length === 0) {
      return;
    }

    setEditItems(currentItems => [
      ...currentItems,
      { productId: products[0].id, quantity: 1, note: "", removedIngredients: "" },
    ]);
  }

  async function saveEditedOrder() {
    if (!editingOrder) return;

    try {
      setUpdatingOrderId(editingOrder.id);
      await api.put(`/orders/${editingOrder.id}/items`, {
        items: editItems,
        orderNote: editOrderNote,
      });
      closeEditModal();
      await fetchWaiterData();
    } catch {
      setError("Sipariş düzenlenemedi.");
    } finally {
      setUpdatingOrderId(null);
    }
  }

  const tableNumberById = useMemo(
    () =>
      tables.reduce<Record<number, number>>((tableNumbers, table) => {
        tableNumbers[table.tableId] = table.tableNumber;
        return tableNumbers;
      }, {}),
    [tables],
  );

  const ordersByStatus = useMemo(
    () =>
      orders.reduce<Record<OrderStatus, WaiterOrder[]>>(
        (groups, order) => {
          groups[order.status] = [...groups[order.status], order];
          return groups;
        },
        {
          New: [],
          Preparing: [],
          Ready: [],
          Served: [],
          Paid: [],
        },
      ),
    [orders],
  );

  const filteredOrders = ordersByStatus[selectedStatus];
  const activeOrdersCount = orders.filter((order) => order.status !== "Paid").length;
  const totalOpenAmount = orders
    .filter((order) => order.status !== "Paid")
    .reduce((total, order) => total + order.totalAmount, 0);

  function getTableNumber(order: WaiterOrder) {
    return tableNumberById[order.tableId] ?? order.tableId;
  }

  function getStatusLabel(status: OrderStatus) {
    return statusFilters.find((filter) => filter.status === status)?.label ?? status;
  }

  function formatCurrency(value: number) {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      maximumFractionDigits: 0,
    }).format(value);
  }

  function formatOrderTime(createdAt?: string) {
    if (!createdAt) {
      return "Saat bilgisi yok";
    }

    return new Intl.DateTimeFormat("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(createdAt));
  }

  function getNextAction(order: WaiterOrder) {
    if (order.status === "New") {
      return {
        label: "Hazırlanıyor olarak işaretle",
        status: "Preparing" as const,
      };
    }

    if (order.status === "Ready") {
      return {
        label: "Servis edildi",
        status: "Served" as const,
      };
    }

    if (order.status === "Served") {
      return {
        label: "Ödendi",
        status: "Paid" as const,
      };
    }

    return null;
  }

  function getServiceRequestLabel(type: ServiceRequestPayload["type"]) {
    return type === "Bill" ? "Hesap istiyor" : "Garson çağırıyor";
  }

  function clearServiceRequest(request: ServiceRequestPayload) {
    setServiceRequests((currentRequests) =>
      currentRequests.filter(
        (currentRequest) =>
          !(
            currentRequest.tableId === request.tableId &&
            currentRequest.type === request.type
          ),
      ),
    );
  }

  async function resolveWaiterCall(callId: number) {
    await api.post(`/waiter-calls/${callId}/resolve`);
    setWaiterCalls((currentCalls) =>
      currentCalls.filter((call) => call.id !== callId),
    );
  }

  return (
    <main className="waiter-page">
      <header className="waiter-header">
        <div>
          <p>Salon operasyonu</p>
          <h1>Waiter Panel</h1>
        </div>

        <div className="waiter-header-stats">
          <article>
            <span>Aktif sipariş</span>
            <strong>{activeOrdersCount}</strong>
          </article>
          <article>
            <span>Açık tutar</span>
            <strong>{formatCurrency(totalOpenAmount)}</strong>
          </article>
        </div>
      </header>

      <>
          {serviceRequests.length > 0 && (
            <section className="waiter-service-requests">
              <div className="waiter-panel-heading">
                <div>
                  <p>Müşteri talepleri</p>
                  <h2>Servis Kuyruğu</h2>
                </div>
                <span>{serviceRequests.length} aktif</span>
              </div>

              <div className="waiter-request-list">
                {serviceRequests.map((request) => (
                  <article
                    className={`waiter-request-card request-${request.type.toLowerCase()}`}
                    key={`${request.tableId}-${request.type}`}
                  >
                    <div>
                      <strong>Masa {request.tableNumber}</strong>
                      <span>{getServiceRequestLabel(request.type)}</span>
                    </div>
                    <button
                      className="waiter-request-clear"
                      type="button"
                      onClick={() => clearServiceRequest(request)}
                      aria-label="Servis talebini kapat"
                    >
                      OK
                    </button>
                  </article>
                ))}
              </div>
            </section>
          )}

          {waiterCalls.length > 0 && (
            <section className="waiter-service-requests">
              <div className="waiter-panel-heading">
                <div>
                  <p>Garson çağrıları</p>
                  <h2>Bekleyen Masalar</h2>
                </div>
                <span>{waiterCalls.length} aktif</span>
              </div>
              <div className="waiter-request-list">
                {waiterCalls.map((call) => (
                  <article className="waiter-request-card" key={call.id}>
                    <div>
                      <strong>Masa {call.tableNumber}</strong>
                      <span>{formatOrderTime(call.createdAt)}</span>
                    </div>
                    <button
                      className="waiter-request-clear"
                      type="button"
                      onClick={() => resolveWaiterCall(call.id)}
                    >
                      Çözüldü
                    </button>
                  </article>
                ))}
              </div>
            </section>
          )}

          <section className="waiter-board">
            <aside className="waiter-filter-panel" aria-label="Sipariş durumları">
              <div className="waiter-panel-heading">
                <div>
                  <p>Durumlar</p>
                  <h2>Sipariş Akışı</h2>
                </div>
              </div>

              <div className="waiter-status-tabs">
                {statusFilters.map((filter) => (
                  <button
                    className={
                      selectedStatus === filter.status
                        ? `active status-${filter.status.toLowerCase()}`
                        : `status-${filter.status.toLowerCase()}`
                    }
                    key={filter.status}
                    type="button"
                    onClick={() => setSelectedStatus(filter.status)}
                  >
                    <span>{filter.label}</span>
                    <strong>{ordersByStatus[filter.status].length}</strong>
                  </button>
                ))}
              </div>
            </aside>

            <section className="waiter-orders-panel">
              <div className="waiter-panel-heading">
                <div>
                  <p>Aktif masa siparişleri</p>
                  <h2>{getStatusLabel(selectedStatus)}</h2>
                </div>
                <span>{filteredOrders.length} sipariş</span>
              </div>

              {error && <p className="waiter-state waiter-error">{error}</p>}

              {isLoading && (
                <div className="waiter-loading-list" aria-label="Siparişler yükleniyor">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div className="waiter-skeleton-card" key={index} />
                  ))}
                </div>
              )}

              {!isLoading && !error && filteredOrders.length === 0 && (
                <div className="waiter-empty-detail">
                  <strong>Bu durumda sipariş yok</strong>
                  <span>Mutfak ve müşteri hareketleri geldiğinde kartlar burada görünür.</span>
                </div>
              )}

              {!isLoading && !error && filteredOrders.length > 0 && (
                <div className="waiter-order-list">
                  {filteredOrders.map((order) => {
                    const nextAction = getNextAction(order);

                    return (
                      <article
                        className={`waiter-order-card status-${order.status.toLowerCase()}`}
                        key={order.id}
                      >
                        <div className="waiter-order-top">
                          <div>
                            <span>Masa {getTableNumber(order)}</span>
                            <h3>{order.orderNumber}</h3>
                          </div>
                          <span className={`table-status-badge status-${order.status.toLowerCase()}`}>
                            {getStatusLabel(order.status)}
                          </span>
                        </div>

                        <div className="waiter-order-meta">
                          <span>{formatOrderTime(order.createdAt)}</span>
                          <strong>{formatCurrency(order.totalAmount)}</strong>
                        </div>

                        <ul>
                          {order.items.map((item) => (
                            <li key={`${order.id}-${item.id}-${item.productName}`}>
                              <span>
                                <b>{item.quantity}x</b>
                                {item.productName}
                                {item.removedIngredients && (
                                  <small>Çıkarılanlar: {item.removedIngredients}</small>
                                )}
                                {item.note && <small>{item.note}</small>}
                              </span>
                              <strong>
                                {formatCurrency(item.unitPrice * item.quantity)}
                              </strong>
                            </li>
                          ))}
                        </ul>

                        <div className="waiter-order-actions">
                          <button
                            className="secondary"
                            type="button"
                            onClick={() => setSelectedBillOrder(order)}
                          >
                            Adisyonu görüntüle
                          </button>

                          <button
                            className="secondary"
                            type="button"
                            onClick={() => openEditModal(order)}
                            disabled={
                              !["New", "Preparing"].includes(order.status) ||
                              updatingOrderId === order.id
                            }
                          >
                            Siparişi Düzenle
                          </button>

                          {nextAction && (
                            <button
                              type="button"
                              onClick={() =>
                                updateOrderStatus(order.id, nextAction.status)
                              }
                              disabled={updatingOrderId === order.id}
                            >
                              {updatingOrderId === order.id
                                ? "Güncelleniyor..."
                                : nextAction.label}
                            </button>
                          )}

                          {!["New", "Preparing"].includes(order.status) && (
                            <span className="disabled-action">Bu sipariş artık düzenlenemez.</span>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </section>

          {selectedBillOrder && (
            <div className="waiter-bill-backdrop" role="presentation">
              <section className="waiter-bill-modal" role="dialog" aria-modal="true">
                <div className="waiter-bill-heading">
                  <div>
                    <p>Adisyon</p>
                    <h2>Masa {getTableNumber(selectedBillOrder)}</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedBillOrder(null)}
                    aria-label="Adisyonu kapat"
                  >
                    Kapat
                  </button>
                  <button type="button" onClick={() => window.print()}>
                    Adisyon Yazdır
                  </button>
                </div>

                <div className="waiter-bill-meta">
                  <span>{selectedBillOrder.orderNumber}</span>
                  <span>{formatOrderTime(selectedBillOrder.createdAt)}</span>
                </div>

                <ul className="waiter-bill-items">
                  {selectedBillOrder.items.map((item) => (
                    <li key={`bill-${selectedBillOrder.id}-${item.id}`}>
                      <span>
                        {item.quantity}x {item.productName}
                        {item.removedIngredients && (
                          <small>Çıkarılanlar: {item.removedIngredients}</small>
                        )}
                      </span>
                      <strong>{formatCurrency(item.unitPrice * item.quantity)}</strong>
                    </li>
                  ))}
                </ul>

                <div className="waiter-bill-total">
                  <span>Toplam</span>
                  <strong>{formatCurrency(selectedBillOrder.totalAmount)}</strong>
                </div>
              </section>
            </div>
          )}
      </>

      {isEditModalOpen && editingOrder && (
        <div className="waiter-modal-overlay" onClick={closeEditModal}>
          <div className="waiter-modal" onClick={(e) => e.stopPropagation()}>
            <header className="waiter-modal-header">
              <h2>Siparişi Düzenle - {editingOrder.orderNumber}</h2>
              <button type="button" onClick={closeEditModal}>×</button>
            </header>

            <div className="waiter-modal-body">
              <section className="edit-order-items">
                <h3>Mevcut Ürünler</h3>
                {editItems.map((item, index) => {
                  const product = products.find(p => p.id === item.productId);
                  return (
                    <div key={index} className="edit-item-row">
                      <div className="edit-item-info">
                        <select
                          value={item.productId}
                          onChange={(e) => updateEditItem(index, { productId: Number(e.target.value) })}
                        >
                          {products.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                        <div className="quantity-controls">
                          <button type="button" onClick={() => updateEditItem(index, { quantity: Math.max(1, item.quantity - 1) })}>-</button>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateEditItem(index, { quantity: Number(e.target.value) })}
                          />
                          <button type="button" onClick={() => updateEditItem(index, { quantity: item.quantity + 1 })}>+</button>
                        </div>
                        <button type="button" onClick={() => removeEditItem(index)}>Sil</button>
                      </div>
                      <div className="edit-item-details">
                        <textarea
                          placeholder="Not"
                          value={item.note}
                          onChange={(e) => updateEditItem(index, { note: e.target.value })}
                        />
                        {product?.removableIngredients && (
                          <div className="removable-ingredients">
                            <label>Çıkarılacak malzemeler:</label>
                            {product.removableIngredients
                              .split(',')
                              .map((ing) => ing.trim())
                              .filter(Boolean)
                              .map((ing) => (
                                <label key={ing}>
                                  <input
                                    type="checkbox"
                                    checked={item.removedIngredients?.split(',').map((value) => value.trim()).includes(ing) || false}
                                    onChange={(e) => {
                                      const current = item.removedIngredients
                                        ?.split(',')
                                        .map((value) => value.trim())
                                        .filter(Boolean) || [];
                                      const updated = e.target.checked
                                        ? [...current, ing]
                                        : current.filter((i) => i !== ing);
                                      updateEditItem(index, { removedIngredients: updated.join(', ') });
                                    }}
                                  />
                                  {ing}
                                </label>
                              ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <button type="button" onClick={addEditItem}>Ürün Ekle</button>
              </section>

              <section className="edit-order-note">
                <h3>Sipariş Notu</h3>
                <textarea
                  value={editOrderNote}
                  onChange={(e) => setEditOrderNote(e.target.value)}
                  placeholder="Genel sipariş notu"
                />
              </section>
            </div>

            <footer className="waiter-modal-footer">
              <button type="button" onClick={closeEditModal}>İptal</button>
              <button type="button" onClick={saveEditedOrder} disabled={updatingOrderId === editingOrder.id}>
                {updatingOrderId === editingOrder.id ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </footer>
          </div>
        </div>
      )}
    </main>
  );
}

export default WaiterPage;
