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
  createdAt?: string;
  note?: string | null;
  updatedBy?: number | null;
  message?: string | null;
  items: {
    id: number;
    productId: number;
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
