import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../services/api";
import {
  onOrderCreated,
  onOrderUpdated,
  onPaymentFailed,
  onPaymentSucceeded,
  onServiceRequested,
  onWaiterCallCreated,
  onWaiterCallResolved,
  startOrderHubConnection,
} from "../../services/orderHub";
import type {
  OrderEventPayload,
  ServiceRequestPayload,
} from "../../services/orderHub";
import {
  getDemoOrders,
  getDemoServiceRequests,
  resolveDemoServiceRequest,
  subscribeDemoOrders,
  subscribeDemoServiceRequests,
  updateDemoOrder,
  updateDemoOrderStatus,
  type DemoOrder,
  type DemoServiceRequest,
} from "../../services/demoRealtime";
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
  productId?: number | null;
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
  source?: string | null;
  externalPlatform?: string | null;
  externalOrderId?: string | null;
  externalCustomerName?: string | null;
  externalCustomerPhone?: string | null;
  externalDeliveryAddress?: string | null;
  externalNote?: string | null;
  paymentStatus?: string | null;
  paymentProvider?: string | null;
  isPaid?: boolean;
  paidAt?: string | null;
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

type PendingTableRequest = {
  key: string;
  source: "hub" | "demo" | "waiterCall";
  id?: number;
  tableId: number;
  tableNumber: number;
  type: "Waiter" | "Bill";
  requestedAt: string;
};

type WaiterAlert = {
  id: string;
  tone: "new" | "service" | "payment" | "info";
  title: string;
  message: string;
  tableNumber?: number;
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

const demoWaiterTables: WaiterTable[] = [
  { tableId: 1, tableNumber: 1, activeOrderCount: 2, totalAmount: 760, status: "Active" },
  { tableId: 2, tableNumber: 2, activeOrderCount: 1, totalAmount: 420, status: "Ready" },
  { tableId: 3, tableNumber: 3, activeOrderCount: 1, totalAmount: 285, status: "Served" },
];

const demoWaiterOrders: WaiterOrder[] = [
  {
    id: 9001,
    orderNumber: "DEMO-101",
    tableId: 1,
    status: "New",
    totalAmount: 390,
    createdAt: new Date().toISOString(),
    items: [
      { id: 1, productId: 101, productName: "Classic Burger", quantity: 1, unitPrice: 245, note: "Soğansız" },
      { id: 2, productId: 102, productName: "Limonata", quantity: 1, unitPrice: 145 },
    ],
  },
  {
    id: 9002,
    orderNumber: "DEMO-102",
    tableId: 2,
    status: "Ready",
    totalAmount: 420,
    createdAt: new Date(Date.now() - 9 * 60 * 1000).toISOString(),
    items: [
      { id: 3, productId: 103, productName: "Izgara Tavuk", quantity: 1, unitPrice: 320 },
      { id: 4, productId: 104, productName: "Ayran", quantity: 2, unitPrice: 50 },
    ],
  },
  {
    id: 9003,
    orderNumber: "DEMO-103",
    tableId: 3,
    status: "Served",
    totalAmount: 285,
    createdAt: new Date(Date.now() - 22 * 60 * 1000).toISOString(),
    items: [
      { id: 5, productId: 105, productName: "Mercimek Çorbası", quantity: 1, unitPrice: 120 },
      { id: 6, productId: 106, productName: "Türk Kahvesi", quantity: 1, unitPrice: 85 },
    ],
  },
];

const demoWaiterProducts: Product[] = [
  { id: 105, name: "Mercimek Çorbası", price: 120, ingredients: "Kırmızı mercimek, tereyağı, limon", removableIngredients: "Limon" },
  { id: 106, name: "Patates Kızartması", price: 135, ingredients: "Çıtır patates, ev sosu", removableIngredients: "Sos" },
  { id: 107, name: "Mozzarella Sticks", price: 165, ingredients: "Mozzarella, çıtır kaplama, dip sos", removableIngredients: "Dip sos" },
  { id: 103, name: "Izgara Tavuk", price: 320, ingredients: "Izgara tavuk, pilav, salata", removableIngredients: "Salata,Soğan" },
  { id: 108, name: "Köfte Porsiyon", price: 345, ingredients: "Izgara köfte, patates, köz biber", removableIngredients: "Soğan,Köz biber" },
  { id: 109, name: "Tavuk Fajita", price: 360, ingredients: "Tavuk, biber, soğan, tortilla", removableIngredients: "Soğan,Biber" },
  { id: 101, name: "Classic Burger", price: 245, ingredients: "Dana köfte, cheddar, turşu", removableIngredients: "Soğan,Turşu" },
  { id: 110, name: "Cheeseburger", price: 275, ingredients: "Dana köfte, çift cheddar, özel sos", removableIngredients: "Soğan,Turşu,Sos" },
  { id: 111, name: "BBQ Burger", price: 295, ingredients: "Dana köfte, bbq sos, karamelize soğan", removableIngredients: "Soğan,BBQ sos" },
  { id: 112, name: "Margherita Pizza", price: 280, ingredients: "Domates sos, mozzarella, fesleğen", removableIngredients: "Fesleğen" },
  { id: 113, name: "Karışık Pizza", price: 330, ingredients: "Sucuk, salam, mantar, biber, mozzarella", removableIngredients: "Mantar,Biber" },
  { id: 114, name: "Sucuklu Pizza", price: 315, ingredients: "Sucuk, mozzarella, domates sos", removableIngredients: "Sucuk" },
  { id: 115, name: "Su", price: 35 },
  { id: 104, name: "Ayran", price: 50 },
  { id: 116, name: "Kola", price: 75 },
  { id: 102, name: "Limonata", price: 145 },
  { id: 117, name: "Türk Kahvesi", price: 85 },
  { id: 118, name: "Sütlaç", price: 120 },
  { id: 119, name: "Cheesecake", price: 165 },
  { id: 120, name: "Brownie", price: 150 },
];

const demoWaiterCalls: WaiterCall[] = [
  {
    id: 9101,
    tableId: 1,
    tableNumber: 1,
    status: "Pending",
    message: "Garson çağrısı",
    createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
  },
];

function demoOrderToWaiterOrder(order: DemoOrder): WaiterOrder {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    tableId: order.tableId,
    status: order.status,
    totalAmount: order.totalAmount,
    createdAt: order.createdAt,
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      note: item.note,
      removedIngredients: item.removedIngredients,
    })),
  };
}

function mergeWaiterOrdersWithDemo(orders: WaiterOrder[]) {
  const demoOrders = getDemoOrders().map(demoOrderToWaiterOrder);
  const orderIds = new Set(demoOrders.map((order) => order.id));

  return [
    ...demoOrders,
    ...orders.filter((order) => !orderIds.has(order.id)),
  ];
}

function mergeProductsWithDemo(products: Product[]) {
  const productMap = new Map<number, Product>();

  [...products, ...demoWaiterProducts].forEach((product) => {
    productMap.set(product.id, product);
  });

  return Array.from(productMap.values()).sort((firstProduct, secondProduct) =>
    firstProduct.name.localeCompare(secondProduct.name, "tr"),
  );
}

function getOrderSourceLabel(order: Pick<WaiterOrder, "source" | "externalPlatform">) {
  const source = order.externalPlatform || order.source || "QR";

  if (source === "TrendyolGo") return "Trendyol Go";
  if (source === "GetirYemek") return "GetirYemek";
  if (source === "Yemeksepeti") return "Yemeksepeti";

  return "QR";
}

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
  const [demoServiceRequests, setDemoServiceRequests] = useState<
    DemoServiceRequest[]
  >(() => getDemoServiceRequests());
  const [waiterCalls, setWaiterCalls] = useState<WaiterCall[]>([]);
  const [editingOrder, setEditingOrder] = useState<WaiterOrder | null>(null);
  const [editItems, setEditItems] = useState<EditOrderItem[]>([]);
  const [editOrderNote, setEditOrderNote] = useState<string>("");
  const [products, setProducts] = useState<Product[]>([]);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [waiterAlerts, setWaiterAlerts] = useState<WaiterAlert[]>([]);

  const pushWaiterAlert = useCallback((alert: Omit<WaiterAlert, "id" | "createdAt">) => {
    const createdAt = new Date().toISOString();

    setWaiterAlerts((currentAlerts) => [
      {
        ...alert,
        id: `${alert.tone}-${alert.tableNumber ?? "all"}-${Date.now()}`,
        createdAt,
      },
      ...currentAlerts,
    ].slice(0, 4));
  }, []);

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
      setProducts(mergeProductsWithDemo(productsResponse.data));
      setOrders(
        mergeWaiterOrdersWithDemo(
          ordersResponse.data.filter((order) =>
            visibleStatuses.includes(order.status),
          ),
        ),
      );
    } catch {
      setError(null);
      setTables(demoWaiterTables);
      setOrders(mergeWaiterOrdersWithDemo(demoWaiterOrders));
      setProducts(mergeProductsWithDemo([]));
      setWaiterCalls(demoWaiterCalls);
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
      source: orderEvent.source,
      externalPlatform: orderEvent.externalPlatform,
      externalOrderId: orderEvent.externalOrderId,
      externalCustomerName: orderEvent.externalCustomerName,
      externalCustomerPhone: orderEvent.externalCustomerPhone,
      externalDeliveryAddress: orderEvent.externalDeliveryAddress,
      externalNote: orderEvent.externalNote,
      paymentStatus: orderEvent.paymentStatus,
      paymentProvider: orderEvent.paymentProvider,
      isPaid: orderEvent.isPaid,
      paidAt: orderEvent.paidAt,
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

    const unsubscribeOrderCreated = onOrderCreated((order) => {
      mergeRealtimeOrder(order);
      setSelectedStatus("New");
      pushWaiterAlert({
        tone: "new",
        title: "Yeni sipariş geldi",
        message: `${order.orderNumber} masadan gönderildi.`,
        tableNumber: order.tableNumber,
      });
    });
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
      pushWaiterAlert({
        tone: "service",
        title: getServiceRequestLabel(request.type),
        message: getServiceRequestDescription(request.type),
        tableNumber: request.tableNumber,
      });
    });
    const unsubscribeWaiterCallCreated = onWaiterCallCreated((call) => {
      setWaiterCalls((currentCalls) => [
        {
          id: call.id,
          tableId: call.tableId,
          tableNumber: call.tableNumber,
          status: call.status,
          message: call.message,
          createdAt: call.createdAt,
        },
        ...currentCalls.filter((currentCall) => currentCall.id !== call.id),
      ]);
      pushWaiterAlert({
        tone: "service",
        title: "Garson çağrısı",
        message: call.message || "Müşteri garson çağırıyor.",
        tableNumber: call.tableNumber,
      });
    });
    const unsubscribeWaiterCallResolved = onWaiterCallResolved((call) => {
      setWaiterCalls((currentCalls) =>
        currentCalls.filter((currentCall) => currentCall.id !== call.id),
      );
    });
    const unsubscribePaymentSucceeded = onPaymentSucceeded((payment) => {
      pushWaiterAlert({
        tone: "payment",
        title: "Ödeme başarılı",
        message: `${formatCurrency(payment.amount)} ${payment.provider} ile alındı.`,
        tableNumber: payment.tableId ?? undefined,
      });
    });
    const unsubscribePaymentFailed = onPaymentFailed((payment) => {
      pushWaiterAlert({
        tone: "payment",
        title: "Ödeme başarısız",
        message: payment.errorMessage || `${payment.provider} ödemesi başarısız oldu.`,
        tableNumber: payment.tableId ?? undefined,
      });
    });

    return () => {
      unsubscribeOrderCreated();
      unsubscribeOrderUpdated();
      unsubscribeServiceRequested();
      unsubscribeWaiterCallCreated();
      unsubscribeWaiterCallResolved();
      unsubscribePaymentSucceeded();
      unsubscribePaymentFailed();
    };
  }, [mergeRealtimeOrder, pushWaiterAlert]);

  useEffect(() => {
    return subscribeDemoOrders((demoOrders) => {
      setOrders((currentOrders) =>
        mergeWaiterOrdersWithDemo(
          currentOrders.filter(
            (order) => !demoOrders.some((demoOrder) => demoOrder.id === order.id),
          ),
        ),
      );
    });
  }, []);

  useEffect(() => {
    return subscribeDemoServiceRequests((requests) => {
      setDemoServiceRequests(requests);
    });
  }, []);

  async function updateOrderStatus(orderId: number, status: OrderStatus) {
    try {
      setUpdatingOrderId(orderId);
      await api.patch(`/orders/${orderId}/status`, { status });
      await fetchWaiterData();
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

  async function markOrderPaid(orderId: number, provider: "Cash" | "Pos") {
    try {
      setUpdatingOrderId(orderId);
      await api.post("/payments/mark-cash-paid", { orderId, provider });
      await fetchWaiterData();
    } catch {
      setError(null);
      setOrders((currentOrders) =>
        currentOrders.map((order) =>
          order.id === orderId
            ? {
                ...order,
                status: "Paid",
                isPaid: true,
                paymentStatus: "Paid",
                paymentProvider: provider,
                paidAt: new Date().toISOString(),
              }
            : order,
        ),
      );
      updateDemoOrderStatus(orderId, "Paid");
      pushWaiterAlert({
        tone: "payment",
        title: "Ödeme işaretlendi",
        message: provider === "Cash" ? "Kasada ödeme alındı." : "POS ödemesi alındı.",
      });
    } finally {
      setUpdatingOrderId(null);
    }
  }

  function openEditModal(order: WaiterOrder) {
    setEditingOrder(order);
    setEditItems(
      order.items
        .filter((item) => item.productId !== null && item.productId !== undefined)
        .map((item) => ({
          productId: item.productId as number,
          quantity: item.quantity,
          note: item.note || "",
          removedIngredients: item.removedIngredients || "",
        })),
    );
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

    const updatedItems = editItems.map((item, index) => {
      const product = products.find((currentProduct) => currentProduct.id === item.productId);

      return {
        id: editingOrder.items[index]?.id ?? Date.now() + index,
        productId: item.productId,
        productName: product?.name ?? "Demo Ürün",
        quantity: item.quantity,
        unitPrice: product?.price ?? 0,
        note: item.note,
        removedIngredients: item.removedIngredients,
      };
    });
    const updatedTotalAmount = updatedItems.reduce(
      (total, item) => total + item.unitPrice * item.quantity,
      0,
    );
    const applyEditedOrder = () => {
      updateDemoOrder(editingOrder.id, {
        note: editOrderNote,
        totalAmount: updatedTotalAmount,
        items: updatedItems,
      });
      setOrders((currentOrders) =>
        currentOrders.map((order) =>
          order.id === editingOrder.id
            ? {
                ...order,
                note: editOrderNote,
                totalAmount: updatedTotalAmount,
                items: updatedItems,
              }
            : order,
        ),
      );
    };

    try {
      setUpdatingOrderId(editingOrder.id);
      await api.put(`/orders/${editingOrder.id}/items`, {
        items: editItems,
        orderNote: editOrderNote,
      });
      applyEditedOrder();
      closeEditModal();
    } catch {
      setError(null);
      applyEditedOrder();
      closeEditModal();
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

    if (order.status === "Preparing") {
      return {
        label: "Hazır olarak işaretle",
        status: "Ready" as const,
      };
    }

    return null;
  }

  function getServiceRequestLabel(type: ServiceRequestPayload["type"]) {
    return type === "Bill" ? "Hesap istiyor" : "Garson çağırıyor";
  }

  function getServiceRequestDescription(type: ServiceRequestPayload["type"]) {
    return type === "Bill"
      ? "Müşteri hesap istiyor."
      : "Müşteri garson çağırıyor.";
  }

  function clearServiceRequest(
    request: Pick<ServiceRequestPayload, "tableId" | "type">,
  ) {
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
    try {
      await api.post(`/waiter-calls/${callId}/resolve`);
    } catch {
      setError(null);
    }

    setWaiterCalls((currentCalls) =>
      currentCalls.filter((call) => call.id !== callId),
    );
  }

  const pendingTableRequests = useMemo(() => {
    const requestMap = new Map<string, PendingTableRequest>();
    const addRequest = (request: PendingTableRequest) => {
      const existingRequest = requestMap.get(request.key);
      const existingTime = existingRequest?.requestedAt
        ? new Date(existingRequest.requestedAt).getTime()
        : 0;
      const requestTime = new Date(request.requestedAt).getTime();

      if (!existingRequest || requestTime >= existingTime) {
        requestMap.set(request.key, request);
      }
    };

    serviceRequests.forEach((request) =>
      addRequest({
        key: `${request.tableId}-${request.type}`,
        source: "hub",
        tableId: request.tableId,
        tableNumber: request.tableNumber,
        type: request.type,
        requestedAt: request.requestedAt,
      }),
    );

    demoServiceRequests.forEach((request) =>
      addRequest({
        key: `${request.tableId}-${request.type}`,
        source: "demo",
        id: request.id,
        tableId: request.tableId,
        tableNumber: request.tableNumber,
        type: request.type,
        requestedAt: request.requestedAt,
      }),
    );

    waiterCalls.forEach((call) =>
      addRequest({
        key: `${call.tableId}-Waiter`,
        source: "waiterCall",
        id: call.id,
        tableId: call.tableId,
        tableNumber: call.tableNumber,
        type: "Waiter",
        requestedAt: call.createdAt,
      }),
    );

    return Array.from(requestMap.values()).sort(
      (firstRequest, secondRequest) =>
        new Date(secondRequest.requestedAt).getTime() -
        new Date(firstRequest.requestedAt).getTime(),
    );
  }, [demoServiceRequests, serviceRequests, waiterCalls]);

  function resolvePendingTableRequest(request: PendingTableRequest) {
    if (request.source === "waiterCall" && request.id !== undefined) {
      void resolveWaiterCall(request.id);
      return;
    }

    if (request.source === "demo" && request.id !== undefined) {
      resolveDemoServiceRequest(request.id);
      return;
    }

    clearServiceRequest(request);
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

      {waiterAlerts.length > 0 && (
        <section className="waiter-live-alerts" aria-label="Canlı bildirimler">
          {waiterAlerts.map((alert) => (
            <article className={`waiter-live-alert alert-${alert.tone}`} key={alert.id}>
              <div>
                <strong>{alert.title}</strong>
                <p>{alert.message}</p>
                <span>
                  {alert.tableNumber ? `Masa ${alert.tableNumber} · ` : ""}
                  {formatOrderTime(alert.createdAt)}
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  setWaiterAlerts((currentAlerts) =>
                    currentAlerts.filter((currentAlert) => currentAlert.id !== alert.id),
                  )
                }
                aria-label="Bildirimi kapat"
              >
                X
              </button>
            </article>
          ))}
        </section>
      )}

      <>
          {pendingTableRequests.length > 0 && (
            <section className="waiter-service-requests">
              <div className="waiter-panel-heading">
                <div>
                  <p>Garson çağrıları</p>
                  <h2>Bekleyen Masalar</h2>
                </div>
                <span>{pendingTableRequests.length} aktif</span>
              </div>
              <div className="waiter-request-list">
                {pendingTableRequests.map((request) => (
                  <article
                    className={`waiter-request-card request-${request.type.toLowerCase()}`}
                    key={request.key}
                  >
                    <div>
                      <strong>Masa {request.tableNumber}</strong>
                      <span>{getServiceRequestLabel(request.type)}</span>
                      <small>
                        {getServiceRequestDescription(request.type)} ·{" "}
                        {formatOrderTime(request.requestedAt)}
                      </small>
                    </div>
                    <button
                      className="waiter-request-clear"
                      type="button"
                      onClick={() => resolvePendingTableRequest(request)}
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
                            <small className="waiter-source-badge">
                              {getOrderSourceLabel(order)}
                            </small>
                          </div>
                          <div className="waiter-order-badges">
                            <span className={`table-status-badge status-${order.status.toLowerCase()}`}>
                              {getStatusLabel(order.status)}
                            </span>
                            {selectedStatus === "Paid" && (
                              <span
                                className={`table-status-badge payment-${(order.paymentStatus ?? (order.isPaid ? "Paid" : "Pending")).toLowerCase()}`}
                              >
                                {order.paymentProvider
                                  ? `${order.paymentProvider} ile ödendi`
                                  : "Ödendi"}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="waiter-order-meta">
                          <span>{formatOrderTime(order.createdAt)}</span>
                          <strong>{formatCurrency(order.totalAmount)}</strong>
                        </div>
                        {order.externalCustomerName && (
                          <p className="waiter-external-meta">
                            {order.externalCustomerName} · {order.externalCustomerPhone ?? "Telefon yok"}
                          </p>
                        )}
                        {order.externalDeliveryAddress && (
                          <p className="waiter-external-meta">{order.externalDeliveryAddress}</p>
                        )}

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

                          {!order.isPaid && order.status !== "Paid" && (
                            <>
                              <button
                                type="button"
                                onClick={() => markOrderPaid(order.id, "Cash")}
                                disabled={updatingOrderId === order.id}
                              >
                                Kasada ödendi
                              </button>
                              <button
                                type="button"
                                onClick={() => markOrderPaid(order.id, "Pos")}
                                disabled={updatingOrderId === order.id}
                              >
                                POS ile ödendi
                              </button>
                            </>
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
