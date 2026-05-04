export type DemoOrderStatus = "New" | "Preparing" | "Ready" | "Served" | "Paid";

export type DemoOrderItem = {
  id: number;
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  note?: string | null;
  removedIngredients?: string | null;
};

export type DemoOrder = {
  id: number;
  orderNumber: string;
  restaurantId: number;
  tableId: number;
  tableNumber: number;
  status: DemoOrderStatus;
  totalAmount: number;
  createdAt: string;
  note?: string | null;
  items: DemoOrderItem[];
};

const demoOrdersStorageKey = "qrOrderDemoOrders";
const demoOrdersEventName = "qr-order-demo-orders";

function readOrders(): DemoOrder[] {
  try {
    const rawOrders = localStorage.getItem(demoOrdersStorageKey);

    if (!rawOrders) {
      return [];
    }

    const parsedOrders = JSON.parse(rawOrders) as DemoOrder[];

    return Array.isArray(parsedOrders) ? parsedOrders : [];
  } catch {
    return [];
  }
}

function writeOrders(orders: DemoOrder[]) {
  localStorage.setItem(demoOrdersStorageKey, JSON.stringify(orders.slice(0, 30)));
  window.dispatchEvent(new Event(demoOrdersEventName));
}

export function getDemoOrders() {
  return readOrders();
}

export function createDemoOrder(input: {
  restaurantId: number;
  tableId: number;
  tableNumber: number;
  items: {
    productId: number;
    name: string;
    price: number;
    quantity: number;
    note?: string | null;
    removedIngredients?: string | null;
  }[];
}) {
  const createdAt = new Date().toISOString();
  const id = Date.now();
  const order: DemoOrder = {
    id,
    orderNumber: `DEMO-${String(id).slice(-6)}`,
    restaurantId: input.restaurantId,
    tableId: input.tableId,
    tableNumber: input.tableNumber,
    status: "New",
    totalAmount: input.items.reduce(
      (total, item) => total + item.price * item.quantity,
      0,
    ),
    createdAt,
    items: input.items.map((item, index) => ({
      id: id + index + 1,
      productId: item.productId,
      productName: item.name,
      quantity: item.quantity,
      unitPrice: item.price,
      note: item.note,
      removedIngredients: item.removedIngredients,
    })),
  };

  writeOrders([order, ...readOrders().filter((currentOrder) => currentOrder.id !== id)]);

  return order;
}

export function updateDemoOrderStatus(orderId: number, status: DemoOrderStatus) {
  writeOrders(
    readOrders().map((order) =>
      order.id === orderId ? { ...order, status } : order,
    ),
  );
}

export function subscribeDemoOrders(callback: (orders: DemoOrder[]) => void) {
  const handleChange = () => callback(readOrders());

  window.addEventListener(demoOrdersEventName, handleChange);
  window.addEventListener("storage", handleChange);

  return () => {
    window.removeEventListener(demoOrdersEventName, handleChange);
    window.removeEventListener("storage", handleChange);
  };
}
