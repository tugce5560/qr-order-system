import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
} from "@microsoft/signalr";
import { getAuthToken } from "./auth";

export type OrderEventPayload = {
  id: number;
  orderId: number;
  orderNumber: string;
  tableId: number;
  tableNumber?: number;
  status: string;
  totalAmount: number;
  source?: string | null;
  externalPlatform?: string | null;
  externalOrderId?: string | null;
  externalStatus?: string | null;
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
  updatedBy?: number | null;
  message?: string | null;
  items: {
    id: number;
    productId?: number | null;
    productName: string;
    quantity: number;
    unitPrice: number;
    note?: string | null;
    removedIngredients?: string | null;
  }[];
};

export type ServiceRequestPayload = {
  restaurantId: number;
  tableId: number;
  tableNumber: number;
  type: "Waiter" | "Bill";
  requestedAt: string;
};

export type NotificationPayload = {
  type: string;
  title: string;
  description: string;
  restaurantId?: number;
  tableId?: number;
  tableNumber?: number;
  createdAt?: string;
};

export type PaymentEventPayload = {
  paymentId: number;
  id: number;
  orderId?: number | null;
  restaurantId: number;
  tableId?: number | null;
  provider: string;
  status: string;
  amount: number;
  currency: string;
  transactionId?: string | null;
  paymentUrl?: string | null;
  errorMessage?: string | null;
  createdAt?: string;
  updatedAt?: string;
  paidAt?: string | null;
};

export type WaiterCallPayload = {
  id: number;
  restaurantId: number;
  tableId: number;
  tableNumber: number;
  status: string;
  message?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
};

let connection: HubConnection | null = null;
let startPromise: Promise<void> | null = null;

const hubUrl =
  import.meta.env.VITE_SIGNALR_HUB_URL ||
  import.meta.env.VITE_API_BASE_URL?.replace(/\/api\/?$/, "/hubs/orders");

if (!hubUrl) {
  throw new Error("VITE_SIGNALR_HUB_URL or VITE_API_BASE_URL is required.");
}

function getOrderHubConnection() {
  if (connection === null) {
    connection = new HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => getAuthToken() ?? "",
      })
      .withAutomaticReconnect()
      .build();
  }

  return connection;
}

export async function startOrderHubConnection() {
  const orderHubConnection = getOrderHubConnection();

  if (orderHubConnection.state === HubConnectionState.Connected) {
    return;
  }

  if (startPromise !== null) {
    return startPromise;
  }

  startPromise = orderHubConnection
    .start()
    .catch(() => {
      // Realtime updates are best-effort; polling/manual refresh remains available.
    })
    .finally(() => {
      startPromise = null;
    });

  return startPromise;
}

export function onOrderCreated(callback: (order: OrderEventPayload) => void) {
  const orderHubConnection = getOrderHubConnection();

  orderHubConnection.on("OrderCreated", callback);

  return () => {
    orderHubConnection.off("OrderCreated", callback);
  };
}

export function onOrderStatusUpdated(
  callback: (order: OrderEventPayload) => void,
) {
  const orderHubConnection = getOrderHubConnection();

  orderHubConnection.on("OrderStatusUpdated", callback);

  return () => {
    orderHubConnection.off("OrderStatusUpdated", callback);
  };
}

export function onOrderUpdated(callback: (order: OrderEventPayload) => void) {
  const orderHubConnection = getOrderHubConnection();

  orderHubConnection.on("OrderUpdated", callback);

  return () => {
    orderHubConnection.off("OrderUpdated", callback);
  };
}

export function onServiceRequested(
  callback: (request: ServiceRequestPayload) => void,
) {
  const orderHubConnection = getOrderHubConnection();

  orderHubConnection.on("ServiceRequested", callback);

  return () => {
    orderHubConnection.off("ServiceRequested", callback);
  };
}

export function onNotificationCreated(
  callback: (notification: NotificationPayload) => void,
) {
  const orderHubConnection = getOrderHubConnection();

  orderHubConnection.on("NotificationCreated", callback);

  return () => {
    orderHubConnection.off("NotificationCreated", callback);
  };
}

export function onWaiterCallCreated(callback: (call: WaiterCallPayload) => void) {
  const orderHubConnection = getOrderHubConnection();

  orderHubConnection.on("WaiterCallCreated", callback);

  return () => {
    orderHubConnection.off("WaiterCallCreated", callback);
  };
}

export function onWaiterCallResolved(callback: (call: WaiterCallPayload) => void) {
  const orderHubConnection = getOrderHubConnection();

  orderHubConnection.on("WaiterCallResolved", callback);

  return () => {
    orderHubConnection.off("WaiterCallResolved", callback);
  };
}

export function onPaymentCreated(callback: (payment: PaymentEventPayload) => void) {
  const orderHubConnection = getOrderHubConnection();

  orderHubConnection.on("PaymentCreated", callback);

  return () => {
    orderHubConnection.off("PaymentCreated", callback);
  };
}

export function onPaymentSucceeded(callback: (payment: PaymentEventPayload) => void) {
  const orderHubConnection = getOrderHubConnection();

  orderHubConnection.on("PaymentSucceeded", callback);

  return () => {
    orderHubConnection.off("PaymentSucceeded", callback);
  };
}

export function onPaymentFailed(callback: (payment: PaymentEventPayload) => void) {
  const orderHubConnection = getOrderHubConnection();

  orderHubConnection.on("PaymentFailed", callback);

  return () => {
    orderHubConnection.off("PaymentFailed", callback);
  };
}

export function onOrderPaymentUpdated(callback: (payment: PaymentEventPayload) => void) {
  const orderHubConnection = getOrderHubConnection();

  orderHubConnection.on("OrderPaymentUpdated", callback);

  return () => {
    orderHubConnection.off("OrderPaymentUpdated", callback);
  };
}
