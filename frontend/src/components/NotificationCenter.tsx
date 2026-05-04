import { useEffect, useState } from "react";
import {
  onNotificationCreated,
  startOrderHubConnection,
  type NotificationPayload,
} from "../services/orderHub";
import { subscribeDemoServiceRequests } from "../services/demoRealtime";
import { getCurrentUser } from "../services/auth";
import "./NotificationCenter.css";

type NotificationItem = NotificationPayload & {
  id: string;
};

function shouldShow(notification: NotificationPayload, role: string) {
  if (role === "RestaurantAdmin" || role === "SuperAdmin") {
    return true;
  }

  if (role === "Kitchen") {
    return ["OrderCreated", "OrderStatusUpdated"].includes(notification.type);
  }

  if (role === "Waiter") {
    return ["OrderCreated", "OrderStatusUpdated", "WaiterCallCreated", "PaymentCompleted"].includes(
      notification.type,
    );
  }

  return false;
}

function NotificationCenter() {
  const user = getCurrentUser();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    if (!user || user.role === "Customer") {
      return undefined;
    }

    startOrderHubConnection();

    const unsubscribeNotification = onNotificationCreated((notification) => {
      if (!shouldShow(notification, user.role)) {
        return;
      }

      setNotifications((currentNotifications) => [
        {
          ...notification,
          id: `${notification.type}-${notification.tableId ?? "all"}-${Date.now()}`,
        },
        ...currentNotifications,
      ]);
    });

    const unsubscribeDemoRequests = subscribeDemoServiceRequests((requests) => {
      if (
        user.role !== "RestaurantAdmin" &&
        user.role !== "SuperAdmin" &&
        user.role !== "Waiter"
      ) {
        return;
      }

      const latestRequest = requests[0];

      if (!latestRequest) {
        return;
      }

      const isBillRequest = latestRequest.type === "Bill";

      setNotifications((currentNotifications) => [
        {
          id: `DemoServiceRequest-${latestRequest.id}`,
          type: isBillRequest ? "BillRequested" : "WaiterCallCreated",
          title: isBillRequest ? "Hesap isteği" : "Garson çağrısı",
          description: isBillRequest
            ? "Müşteri hesap istiyor."
            : "Müşteri garson çağırıyor.",
          restaurantId: latestRequest.restaurantId,
          tableId: latestRequest.tableId,
          tableNumber: latestRequest.tableNumber,
          createdAt: latestRequest.requestedAt,
        },
        ...currentNotifications.filter(
          (notification) => notification.id !== `DemoServiceRequest-${latestRequest.id}`,
        ),
      ]);
    });

    return () => {
      unsubscribeNotification();
      unsubscribeDemoRequests();
    };
  }, [user]);

  if (!user || notifications.length === 0) {
    return null;
  }

  return (
    <aside className="notification-center" aria-label="Bildirimler">
      {notifications.map((notification) => (
        <article className="notification-toast" key={notification.id}>
          <button
            type="button"
            onClick={() =>
              setNotifications((currentNotifications) =>
                currentNotifications.filter((item) => item.id !== notification.id),
              )
            }
            aria-label="Bildirimi kapat"
          >
            X
          </button>
          <strong>{notification.title}</strong>
          <p>{notification.description}</p>
          <span>
            {notification.tableNumber ? `Masa ${notification.tableNumber} · ` : ""}
            {notification.createdAt
              ? new Intl.DateTimeFormat("tr-TR", {
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date(notification.createdAt))
              : "Şimdi"}
          </span>
        </article>
      ))}
    </aside>
  );
}

export default NotificationCenter;
