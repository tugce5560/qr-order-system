import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../services/api";
import {
  onOrderCreated,
  onOrderUpdated,
  startOrderHubConnection,
} from "../../services/orderHub";
import type { OrderEventPayload } from "../../services/orderHub";
import "./CustomerPage.css";

type Product = {
  id: number;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  calories?: string | number | null;
  allergens?: string | null;
  ingredients?: string | null;
  removableIngredients?: string | null;
  estimatedPreparationMinutes?: number | null;
};

type Category = {
  id: number;
  name: string;
  displayOrder: number;
  products: Product[];
};

type CartItem = {
  productId: number;
  name: string;
  price: number;
  quantity: number;
  imageUrl: string;
  note: string;
  removedIngredients: string;
};

type ResolvedTable = {
  restaurantId: number;
  tableId: number;
  tableNumber: number;
  restaurantName: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  menuBackgroundColor?: string | null;
  buttonColor?: string | null;
};

type CustomerNotice = {
  tone: "success" | "warning" | "error";
  message: string;
};

type CreatePaymentResponse = {
  billId: number;
  amount: number;
};

type TableSessionResponse = {
  token: string;
  expiresAt: string;
};

type CustomerOrder = {
  id: number;
  tableId: number;
  orderNumber: string;
  status: string;
  totalAmount: number;
  createdAt?: string;
  items: {
    id: number;
    productName: string;
    quantity: number;
    unitPrice: number;
    note?: string | null;
  }[];
};

const orderStatusLabels: Record<string, string> = {
  New: "Sipariş alındı",
  Preparing: "Hazırlanıyor",
  Ready: "Hazır",
  Served: "Teslim edildi",
  Paid: "Ödendi",
  Cancelled: "İptal edildi",
};

const orderStatusSteps = ["New", "Preparing", "Ready", "Served", "Paid"];

const placeholderStyles: Record<string, { color: string; label: string }> = {
  cola: { color: "#5a1f1f", label: "Cola" },
  water: { color: "#1f6f8b", label: "Water" },
  burger: { color: "#8a4d20", label: "Burger" },
  pizza: { color: "#a74325", label: "Pizza" },
  cake: { color: "#8b476d", label: "Cake" },
  "ice cream": { color: "#5e6f9f", label: "Ice Cream" },
};

const productPhotoUrls: Record<string, string> = {
  cola: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=900&q=80",
  water:
    "https://images.unsplash.com/photo-1559839914-17aae19cec71?auto=format&fit=crop&w=900&q=80",
  burger:
    "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80",
  pizza:
    "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?auto=format&fit=crop&w=900&q=80",
  cake: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=900&q=80",
  "ice cream":
    "https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=900&q=80",
};

const restaurantCoverImages: Record<string, string> = {
  "demo-restaurant":
    "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1600&q=84",
  "mavi-masa-bistro":
    "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1600&q=84",
  "kuzey-grill":
    "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1600&q=84",
  "limon-cafe":
    "https://images.unsplash.com/photo-1521017432531-fbd92d768814?auto=format&fit=crop&w=1600&q=84",
};

function getApiErrorMessage(error: unknown, fallback: string) {
  if (typeof error !== "object" || error === null || !("response" in error)) {
    return fallback;
  }

  const response = (
    error as {
      response?: {
        data?: unknown;
      };
    }
  ).response;

  if (typeof response?.data === "string") {
    return response.data;
  }

  if (
    typeof response?.data === "object" &&
    response.data !== null &&
    "message" in response.data
  ) {
    return String((response.data as { message: unknown }).message);
  }

  if (
    typeof response?.data === "object" &&
    response.data !== null &&
    "title" in response.data
  ) {
    return String((response.data as { title: unknown }).title);
  }

  return fallback;
}

function createPlaceholderImage(productName: string) {
  const normalizedName = productName.toLowerCase();
  const style =
    Object.entries(placeholderStyles).find(([key]) =>
      normalizedName.includes(key),
    )?.[1] ?? { color: "#3f5f45", label: productName };

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="900" height="620" viewBox="0 0 900 620">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="${style.color}"/>
          <stop offset="1" stop-color="#151515"/>
        </linearGradient>
      </defs>
      <rect width="900" height="620" fill="url(#bg)"/>
      <circle cx="710" cy="120" r="170" fill="rgba(255,255,255,0.13)"/>
      <circle cx="170" cy="520" r="210" fill="rgba(255,255,255,0.08)"/>
      <rect x="78" y="78" width="744" height="464" rx="44" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
      <text x="450" y="295" text-anchor="middle" font-family="Arial, sans-serif" font-size="62" font-weight="700" fill="#fff">${style.label}</text>
      <text x="450" y="352" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="rgba(255,255,255,0.78)">Freshly prepared</text>
    </svg>
  `;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function getProductImageUrl(product: Pick<Product, "name" | "imageUrl">) {
  if (product.imageUrl?.trim()) {
    return product.imageUrl;
  }

  const normalizedName = product.name.toLowerCase();
  const photoUrl = Object.entries(productPhotoUrls).find(([key]) =>
    normalizedName.includes(key),
  )?.[1];

  return photoUrl || createPlaceholderImage(product.name);
}

function getRestaurantCoverImage(restaurantSlug?: string) {
  if (!restaurantSlug) {
    return restaurantCoverImages["demo-restaurant"];
  }

  return restaurantCoverImages[restaurantSlug] ?? restaurantCoverImages["demo-restaurant"];
}

export default function CustomerPage() {
  const { restaurantSlug, tableNumber } = useParams();
  const [categories, setCategories] = useState<Category[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [resolvedTable, setResolvedTable] = useState<ResolvedTable>({
    restaurantId: 1,
    tableId: 1,
    tableNumber: 1,
    restaurantName: "Demo Restaurant",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCallingWaiter, setIsCallingWaiter] = useState(false);
  const [isRequestingBill, setIsRequestingBill] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);
  const [serviceMessage, setServiceMessage] = useState<string | null>(null);
  const [customerNotice, setCustomerNotice] = useState<CustomerNotice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [modalQuantity, setModalQuantity] = useState(1);
  const [modalNote, setModalNote] = useState("");
  const [excludedIngredients, setExcludedIngredients] = useState<string[]>([]);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [speedRating, setSpeedRating] = useState(5);
  const [tasteRating, setTasteRating] = useState(5);
  const [serviceRating, setServiceRating] = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [isRatingSubmitting, setIsRatingSubmitting] = useState(false);
  const [canRateOrder, setCanRateOrder] = useState(false);
  const [ratedTableIds, setRatedTableIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [customerOrders, setCustomerOrders] = useState<CustomerOrder[]>([]);
  const [orderStatusMessage, setOrderStatusMessage] = useState<string | null>(
    null,
  );
  const [tableSessionToken, setTableSessionToken] = useState<string | null>(null);
  const [tableSessionExpiresAt, setTableSessionExpiresAt] = useState<string | null>(
    null,
  );
  const [isTableResolved, setIsTableResolved] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isOrdersOpen, setIsOrdersOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const latestTableIdRef = useRef(resolvedTable.tableId);

  const cartTotal = cartItems.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  );

  const cartItemCount = cartItems.reduce(
    (total, item) => total + item.quantity,
    0,
  );

  const hasBillableOrders = customerOrders.some(
    (order) => !["paid", "cancelled"].includes(order.status.toLowerCase()),
  );

  const hasRatedCurrentSession =
    ratedTableIds.has(resolvedTable.tableId) ||
    sessionStorage.getItem(`customerRatedTable:${resolvedTable.tableId}`) ===
      "true";

  useEffect(() => {
    async function loadCustomerMenu() {
      try {
        setIsLoading(true);
        setError(null);
        setIsTableResolved(false);
        setCustomerOrders([]);
        setTableSessionToken(null);
        setTableSessionExpiresAt(null);
        setCanRateOrder(false);

        let tableContext: ResolvedTable = {
          restaurantId: 1,
          tableId: 1,
          tableNumber: 1,
          restaurantName: "Demo Restaurant",
        };

        if (restaurantSlug && tableNumber) {
          const resolveResponse = await api.get<ResolvedTable>(
            "/public/resolve-table",
            {
              params: {
                restaurantSlug,
                tableNumber,
              },
            },
          );

          tableContext = resolveResponse.data;
        }

        setResolvedTable(tableContext);
        latestTableIdRef.current = tableContext.tableId;
        sessionStorage.setItem("customerRestaurantId", String(tableContext.restaurantId));
        sessionStorage.setItem("customerTableId", String(tableContext.tableId));
        sessionStorage.setItem(
          "customerTableNumber",
          String(tableContext.tableNumber),
        );

        const menuResponse = await api.get<Category[]>(
          `/menu/${tableContext.restaurantId}`,
        );

        const tableSessionResponse = await api.post<TableSessionResponse>(
          "/public/table-session",
          {
            restaurantId: tableContext.restaurantId,
            tableId: tableContext.tableId,
          },
        );

        setTableSessionToken(tableSessionResponse.data.token);
        setTableSessionExpiresAt(tableSessionResponse.data.expiresAt);
        setCategories(menuResponse.data);
        setIsTableResolved(true);
      } catch {
        setError("Masa veya menü yüklenemedi. QR linkini kontrol edin.");
      } finally {
        setIsLoading(false);
      }
    }

    loadCustomerMenu();
  }, [restaurantSlug, tableNumber]);

  const loadTableOrders = useCallback(async () => {
    if (!isTableResolved) {
      return;
    }

    const tableId = resolvedTable.tableId;

    try {
      const ordersResponse = await api.get<CustomerOrder[]>(
        `/orders?restaurantId=${resolvedTable.restaurantId}&tableId=${tableId}`,
      );

      if (tableId !== latestTableIdRef.current) {
        return;
      }

      setCustomerOrders(ordersResponse.data);
      setCanRateOrder(
        ordersResponse.data.some(
          (order) =>
            order.tableId === tableId &&
            ["served", "paid"].includes(order.status.toLowerCase()),
        ),
      );
    } catch {
      setCanRateOrder(false);
    }
  }, [isTableResolved, resolvedTable.restaurantId, resolvedTable.tableId]);

  useEffect(() => {
    if (!isTableResolved) {
      return;
    }

    window.setTimeout(() => {
      void loadTableOrders();
    }, 0);

    const intervalId = window.setInterval(loadTableOrders, 10000);

    return () => window.clearInterval(intervalId);
  }, [isTableResolved, loadTableOrders, resolvedTable.tableId]);

  useEffect(() => {
    if (!isTableResolved) {
      return;
    }

    startOrderHubConnection();

    const handleOrderEvent = (orderEvent: OrderEventPayload) => {
      if (orderEvent.tableId !== resolvedTable.tableId) {
        return;
      }

      if (orderEvent.status === "Ready") {
        setOrderStatusMessage("Siparişiniz hazır.");
      }

      if (orderEvent.status === "Served") {
        setOrderStatusMessage(
          "Siparişiniz teslim edildi. Deneyiminizi değerlendirebilirsiniz.",
        );
      }

      const realtimeOrder: CustomerOrder = {
        id: orderEvent.id ?? orderEvent.orderId,
        tableId: orderEvent.tableId,
        orderNumber: orderEvent.orderNumber,
        status: orderEvent.status,
        totalAmount: orderEvent.totalAmount,
        createdAt: orderEvent.createdAt,
        items: orderEvent.items ?? [],
      };

      setCustomerOrders((currentOrders) => {
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

      setCanRateOrder((currentValue) =>
        ["served", "paid"].includes(orderEvent.status.toLowerCase())
          ? true
          : currentValue,
      );
    };

    const unsubscribeCreated = onOrderCreated(handleOrderEvent);
    const unsubscribeUpdated = onOrderUpdated(handleOrderEvent);

    return () => {
      unsubscribeCreated();
      unsubscribeUpdated();
    };
  }, [isTableResolved, loadTableOrders, resolvedTable.tableId]);

  function addToCart(
    product: Product,
    quantity = 1,
    note = "",
    removedIngredients = "",
  ) {
    const trimmedNote = note.trim();
    const trimmedRemovedIngredients = removedIngredients.trim();

    setCartItems((currentItems) => {
      const existingItem = currentItems.find(
        (item) =>
          item.productId === product.id &&
          item.note === trimmedNote &&
          item.removedIngredients === trimmedRemovedIngredients,
      );

      if (existingItem) {
        return currentItems.map((item) =>
          item.productId === product.id &&
          item.note === trimmedNote &&
          item.removedIngredients === trimmedRemovedIngredients
            ? { ...item, quantity: item.quantity + quantity }
            : item,
        );
      }

      return [
        ...currentItems,
        {
          productId: product.id,
          name: product.name,
          price: product.price,
          imageUrl: getProductImageUrl(product),
          quantity,
          note: trimmedNote,
          removedIngredients: trimmedRemovedIngredients,
        },
      ];
    });
  }

  function increaseQuantity(productId: number, note: string, removedIngredients: string) {
    setCartItems((currentItems) =>
      currentItems.map((item) =>
        item.productId === productId &&
        item.note === note &&
        item.removedIngredients === removedIngredients
          ? { ...item, quantity: item.quantity + 1 }
          : item,
      ),
    );
  }

  function decreaseQuantity(productId: number, note: string, removedIngredients: string) {
    setCartItems((currentItems) =>
      currentItems
        .map((item) =>
          item.productId === productId &&
          item.note === note &&
          item.removedIngredients === removedIngredients
            ? { ...item, quantity: item.quantity - 1 }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }

  function removeFromCart(productId: number, note: string, removedIngredients: string) {
    setCartItems((currentItems) =>
      currentItems.filter(
        (item) =>
          !(
            item.productId === productId &&
            item.note === note &&
            item.removedIngredients === removedIngredients
          ),
      ),
    );
  }

  function openProductModal(product: Product) {
    setSelectedProduct(product);
    setModalQuantity(1);
    setModalNote("");
    setExcludedIngredients([]);
  }

  function closeProductModal() {
    setSelectedProduct(null);
  }

  function scrollToCategory(categoryId: number) {
    document
      .getElementById(`category-${categoryId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function goToMyOrders() {
    sessionStorage.setItem("customerTableId", String(resolvedTable.tableId));
    sessionStorage.setItem(
      "customerTableNumber",
      String(resolvedTable.tableNumber),
    );
    setIsOrdersOpen(true);
  }

  function addSelectedProductToCart() {
    if (selectedProduct === null) {
      return;
    }

    addToCart(
      selectedProduct,
      modalQuantity,
      modalNote,
      excludedIngredients.join(", "),
    );
    closeProductModal();
  }

  function getProductIngredients(product: Product | null) {
    const source = product?.removableIngredients || product?.ingredients;

    if (!source) {
      return [];
    }

    return source
      .split(/[,;\n]/)
      .map((ingredient) => ingredient.trim())
      .filter(Boolean);
  }

  function toggleExcludedIngredient(ingredient: string) {
    setExcludedIngredients((currentIngredients) =>
      currentIngredients.includes(ingredient)
        ? currentIngredients.filter(
            (currentIngredient) => currentIngredient !== ingredient,
          )
        : [...currentIngredients, ingredient],
    );
  }

  function getProductDetailValue(
    product: Product,
    field:
      | "calories"
      | "allergens"
      | "ingredients"
      | "estimatedPreparationMinutes",
  ) {
    if (field === "estimatedPreparationMinutes") {
      return product.estimatedPreparationMinutes
        ? `${product.estimatedPreparationMinutes} dk`
        : "10-15 dk";
    }

    return product[field] || "Belirtilmedi";
  }

  async function callWaiter() {
    try {
      setIsCallingWaiter(true);
      setServiceMessage(null);

      await api.post("/public/service-request", {
        restaurantId: resolvedTable.restaurantId,
        tableId: resolvedTable.tableId,
        type: "Waiter",
      });

      setServiceMessage(
        `Garson çağrıldı. Masa ${resolvedTable.tableNumber} için ekibe haber verildi.`,
      );
      setIsHelpOpen(false);
    } catch (waiterError) {
      setServiceMessage(
        getApiErrorMessage(
          waiterError,
          "Garson çağrısı gönderilemedi. Lütfen birazdan tekrar deneyin.",
        ),
      );
    } finally {
      setIsCallingWaiter(false);
    }
  }

  async function requestBill() {
    try {
      setIsRequestingBill(true);
      setServiceMessage(null);

      const response = await api.post<CreatePaymentResponse>(
        "/payments/create",
        {
          restaurantId: resolvedTable.restaurantId,
          tableId: resolvedTable.tableId,
        },
      );

      setServiceMessage(
        `Hesap istendi. Toplam tutar: ₺${response.data.amount}`,
      );
      try {
        await api.post("/public/service-request", {
          restaurantId: resolvedTable.restaurantId,
          tableId: resolvedTable.tableId,
          type: "Bill",
        });
      } catch {
        setServiceMessage("Hesap isteği alındı, bildirim gönderilemedi.");
      }
      await loadTableOrders();
      setIsHelpOpen(false);
    } catch (billError) {
      setServiceMessage(
        getApiErrorMessage(
          billError,
          "Hesap isteği gönderilemedi. Lütfen birazdan tekrar deneyin.",
        ),
      );
    } finally {
      setIsRequestingBill(false);
    }
  }

  async function submitRating() {
    try {
      setIsRatingSubmitting(true);
      setRatingError(null);

      await api.post("/ratings", {
        restaurantId: resolvedTable.restaurantId,
        tableId: resolvedTable.tableId,
        speed: speedRating,
        taste: tasteRating,
        service: serviceRating,
        comment: ratingComment.trim() || null,
      });

      sessionStorage.setItem(
        `customerRatedTable:${resolvedTable.tableId}`,
        "true",
      );
      setRatedTableIds((currentIds) => {
        const nextIds = new Set(currentIds);
        nextIds.add(resolvedTable.tableId);
        return nextIds;
      });
      setCanRateOrder(false);
      setPaymentMessage("Değerlendirmeniz için teşekkür ederiz.");
      setShowRatingModal(false);
    } catch {
      setRatingError("Değerlendirme gönderilemedi.");
      setPaymentMessage("Değerlendirme gönderilemedi.");
    } finally {
      setIsRatingSubmitting(false);
    }
  }

  function renderRatingInput(
    label: string,
    icon: string,
    value: number,
    setValue: (value: number) => void,
  ) {
    return (
      <div className="rating-field">
        <span>
          {label} <b>{icon}</b>
        </span>
        <div className="rating-stars" role="group" aria-label={`${label} rating`}>
          {[1, 2, 3, 4, 5].map((ratingValue) => (
            <button
              className={ratingValue <= value ? "rating-star active" : "rating-star"}
              key={ratingValue}
              type="button"
              onClick={() => setValue(ratingValue)}
              aria-label={`${ratingValue} out of 5`}
            >
              ★
            </button>
          ))}
        </div>
      </div>
    );
  }

  function getStatusLabel(status: string) {
    return orderStatusLabels[status] || status;
  }

  function getStatusStepIndex(status: string) {
    return orderStatusSteps.includes(status)
      ? orderStatusSteps.indexOf(status)
      : -1;
  }

  function openRatingModal() {
    setSpeedRating(5);
    setTasteRating(5);
    setServiceRating(5);
    setRatingComment("");
    setRatingError(null);
    setShowRatingModal(true);
  }

  async function placeOrder() {
    if (!tableSessionToken) {
      setCustomerNotice({
        tone: "error",
        message: "Masa oturumu bulunamadı. Lütfen QR kodu tekrar okutun.",
      });
      return;
    }

    if (cartItems.length === 0) {
      setCustomerNotice({
        tone: "warning",
        message: "Sipariş vermek için önce sepete ürün ekleyin.",
      });
      return;
    }

    if (
      tableSessionExpiresAt &&
      new Date(tableSessionExpiresAt).getTime() <= Date.now()
    ) {
      setCustomerNotice({
        tone: "error",
        message: "Masa oturumunuzun süresi doldu. Lütfen QR kodu tekrar okutun.",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      setCustomerNotice(null);

      await api.post("/orders", {
        restaurantId: resolvedTable.restaurantId,
        tableId: resolvedTable.tableId,
        tableSessionToken,
        items: cartItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          note: item.note || null,
          removedIngredients: item.removedIngredients || null,
        })),
      });

      setCustomerNotice({
        tone: "success",
        message: "Siparişiniz mutfağa iletildi. Durumu bu ekrandan canlı takip edebilirsiniz.",
      });
      setCartItems([]);
      setIsCartOpen(false);
      await loadTableOrders();
    } catch (orderError) {
      setCustomerNotice({
        tone: "error",
        message: getApiErrorMessage(
          orderError,
          "Sipariş gönderilemedi. Lütfen QR kodu tekrar okutun.",
        ),
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return <p className="customer-status">Menü yükleniyor...</p>;
  }

  if (error) {
    return <p className="customer-status customer-status-error">{error}</p>;
  }

  return (
    <main
      className="customer-page"
      style={{
        background: resolvedTable.menuBackgroundColor || undefined,
        ["--customer-primary" as string]: resolvedTable.primaryColor || undefined,
        ["--customer-accent" as string]: resolvedTable.accentColor || undefined,
        ["--customer-button" as string]: resolvedTable.buttonColor || undefined,
        ["--customer-cover" as string]: `url("${getRestaurantCoverImage(restaurantSlug)}")`,
      }}
    >
      <header className="customer-topbar">
        <div className="customer-brand">
          {resolvedTable.logoUrl && (
            <img src={resolvedTable.logoUrl} alt={resolvedTable.restaurantName} />
          )}
          <span>{resolvedTable.restaurantName}</span>
          <strong>Masa {resolvedTable.tableNumber}</strong>
        </div>
        <div className="customer-topbar-actions">
          <button
            className="customer-cart-link"
            type="button"
            onClick={() => setIsCartOpen(true)}
          >
            <span>
              {cartItemCount > 0 ? `${cartItemCount} · ₺${cartTotal}` : "0"}
            </span>
            Sepetim
          </button>
          <button
            className="customer-orders-link"
            type="button"
            onClick={goToMyOrders}
          >
            <span>{customerOrders.length}</span>
            Siparişlerim
          </button>
          <button
            className="customer-support-link"
            type="button"
            onClick={() => setIsHelpOpen(true)}
            aria-label="Destek seçeneklerini aç"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M12 12.25a4.25 4.25 0 1 0 0-8.5 4.25 4.25 0 0 0 0 8.5Zm0 2c-4.15 0-7.5 2.2-7.5 4.9 0 .7.57 1.25 1.27 1.25h12.46c.7 0 1.27-.55 1.27-1.25 0-2.7-3.35-4.9-7.5-4.9Z" />
            </svg>
            <span>Destek</span>
          </button>
        </div>
      </header>

      <section className="customer-hero">
        <div className="customer-hero-logo">
          {resolvedTable.logoUrl ? (
            <img src={resolvedTable.logoUrl} alt={resolvedTable.restaurantName} />
          ) : (
            <span>{resolvedTable.restaurantName.slice(0, 1)}</span>
          )}
        </div>
        <p className="customer-kicker">QR Menü</p>
        <h1>{resolvedTable.restaurantName}</h1>
        <p className="customer-table">Masa {resolvedTable.tableNumber}</p>
        <p className="customer-subtitle">
          Hoş geldiniz. Favorilerinizi seçin, siparişiniz doğrudan mutfağa iletilsin.
        </p>
      </section>

      {customerNotice && (
        <p className={`customer-message customer-message-${customerNotice.tone}`}>
          {customerNotice.message}
        </p>
      )}
      {paymentMessage && <p className="customer-message">{paymentMessage}</p>}
      {serviceMessage && <p className="customer-message">{serviceMessage}</p>}
      {orderStatusMessage && (
        <p className="customer-message order-status-message">
          {orderStatusMessage}
        </p>
      )}

      {categories.length > 0 && (
        <nav className="category-tabs" aria-label="Menü kategorileri">
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => scrollToCategory(category.id)}
            >
              {category.name}
            </button>
          ))}
        </nav>
      )}

      <div className="customer-content">
        <div className="menu-sections">
          {categories.map((category) => (
            <section
              className="menu-category"
              id={`category-${category.id}`}
              key={category.id}
            >
              <div className="menu-category-heading">
                <h2>{category.name}</h2>
                <span>{category.products.length} ürün</span>
              </div>

              <div className="product-list">
                {category.products.map((product) => (
                  <article
                    className="product-card"
                    key={product.id}
                    onClick={() => openProductModal(product)}
                  >
                    <img
                      className="product-image"
                      src={getProductImageUrl(product)}
                      alt={product.name}
                    />
                    <div className="product-body">
                      <h3>{product.name}</h3>
                      <p>
                        {product.description ||
                          "Şefin önerisi, masanız için taze hazırlanır."}
                      </p>
                      <div className="product-card-footer">
                        <strong>₺{product.price}</strong>
                        <button
                          className="product-add-button"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            addToCart(product);
                          }}
                          aria-label={`${product.name} sepete ekle`}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      <section className="customer-rating-card" aria-labelledby="customer-rating-title">
        <div className="customer-rating-icon" aria-hidden="true">
          ★
        </div>
        <div className="customer-rating-copy">
          <h2 id="customer-rating-title">Deneyiminizi değerlendirin</h2>
          <span>
            {hasRatedCurrentSession
              ? "Geri bildiriminiz alındı."
              : canRateOrder
                ? "İsterseniz hız, servis ve lezzet için kısa bir puan bırakın."
                : "Sipariş servis edilince aktif olur."}
          </span>
        </div>
        <button
          type="button"
          onClick={openRatingModal}
          disabled={!canRateOrder || hasRatedCurrentSession}
        >
          {hasRatedCurrentSession ? "Değerlendirildi" : "Değerlendir"}
        </button>
      </section>

      {isCartOpen && (
        <div
          className="cart-drawer-backdrop"
          role="presentation"
          onClick={() => setIsCartOpen(false)}
        >
          <section
            className="cart-panel cart-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-title"
            onClick={(event) => event.stopPropagation()}
          >
          <div className="cart-header">
            <div>
              <p>Sipariş özeti</p>
              <h2 id="cart-title">Sepetim</h2>
            </div>
            <button
              className="drawer-close-button"
              type="button"
              onClick={() => setIsCartOpen(false)}
              aria-label="Sepeti kapat"
            >
              X
            </button>
          </div>

          {cartItems.length === 0 ? (
            <p className="empty-cart">Sepetiniz boş.</p>
          ) : (
            <>
              <div className="cart-items">
                {cartItems.map((item) => (
                  <article
                    className="cart-item"
                    key={`${item.productId}-${item.note}-${item.removedIngredients}`}
                  >
                    <img
                      className="cart-item-image"
                      src={item.imageUrl}
                      alt={item.name}
                    />
                    <div className="cart-item-main">
                      <div>
                        <h3>{item.name}</h3>
                        <p>₺{item.price} / adet</p>
                        {item.note && (
                          <p className="cart-item-note">Not: {item.note}</p>
                        )}
                        {item.removedIngredients && (
                          <p className="cart-item-note">
                            Çıkarılanlar: {item.removedIngredients}
                          </p>
                        )}
                      </div>
                      <div className="quantity-controls">
                        <button
                          type="button"
                          onClick={() =>
                            decreaseQuantity(
                              item.productId,
                              item.note,
                              item.removedIngredients,
                            )
                          }
                        >
                          -
                        </button>
                        <span>{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() =>
                            increaseQuantity(
                              item.productId,
                              item.note,
                              item.removedIngredients,
                            )
                          }
                        >
                          +
                        </button>
                        <button
                          className="remove-button"
                          type="button"
                          onClick={() =>
                            removeFromCart(
                              item.productId,
                              item.note,
                              item.removedIngredients,
                            )
                          }
                        >
                          Sil
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <div className="cart-total">
                <span>Toplam</span>
                <strong>₺{cartTotal}</strong>
              </div>

              <div className="cart-actions">
                <button
                  className="place-order-button"
                  type="button"
                  onClick={placeOrder}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Sipariş gönderiliyor..." : "Siparişi Gönder"}
                </button>
              </div>
            </>
          )}
          </section>
        </div>
      )}

      {isOrdersOpen && (
        <div
          className="orders-drawer-backdrop"
          role="presentation"
          onClick={() => setIsOrdersOpen(false)}
        >
          <section
            className="customer-orders-panel orders-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="orders-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="customer-orders-header">
              <div>
                <p>Canlı takip</p>
                <h2 id="orders-title">Sipariş Takibi</h2>
              </div>
              <button
                className="drawer-close-button"
                type="button"
                onClick={() => setIsOrdersOpen(false)}
                aria-label="Sipariş takibini kapat"
              >
                X
              </button>
            </div>

            {customerOrders.length === 0 ? (
              <p className="customer-orders-empty">
                Henüz aktif siparişiniz yok.
              </p>
            ) : (
              <div className="customer-order-list">
                {customerOrders.map((order) => {
                  const currentStepIndex = getStatusStepIndex(order.status);

                  return (
                    <article className="customer-order-card" key={order.id}>
                      <div className="customer-order-top">
                        <div>
                          <h3>#{order.orderNumber}</h3>
                          <span
                            className={`customer-order-status status-${order.status.toLowerCase()}`}
                          >
                            {getStatusLabel(order.status)}
                          </span>
                        </div>
                        <strong>₺{order.totalAmount}</strong>
                      </div>

                      {order.status === "Cancelled" ? (
                        <div className="cancelled-order-state">
                          Bu sipariş iptal edildi.
                        </div>
                      ) : (
                        <div className="order-stepper" aria-label="Sipariş durumu">
                          {orderStatusSteps.map((step, index) => (
                            <div
                              className={
                                index <= currentStepIndex
                                  ? "order-step active"
                                  : "order-step"
                              }
                              key={step}
                            >
                              <span />
                              <p>{getStatusLabel(step)}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="customer-order-items">
                        {order.items.map((item) => (
                          <div className="customer-order-item-row" key={item.id}>
                            <div>
                              <span>
                                {item.quantity} x {item.productName}
                              </span>
                              <strong>₺{item.unitPrice * item.quantity}</strong>
                            </div>
                            {item.note && (
                              <p className="customer-order-item-note">
                                {item.note}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {isHelpOpen && (
        <div
          className="help-sheet-backdrop"
          role="presentation"
          onClick={() => setIsHelpOpen(false)}
        >
          <section
            className="help-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="help-sheet-header">
              <div>
                <p>Masa desteği</p>
                <h2 id="help-title">Destek</h2>
              </div>
              <button
                className="drawer-close-button"
                type="button"
                onClick={() => setIsHelpOpen(false)}
                aria-label="Destek penceresini kapat"
              >
                X
              </button>
            </div>
            <div className="help-sheet-actions">
              <button type="button" onClick={callWaiter} disabled={isCallingWaiter}>
                {isCallingWaiter ? "Çağrılıyor..." : "Garson Çağır"}
              </button>
              <button
                type="button"
                onClick={requestBill}
                disabled={isRequestingBill || !hasBillableOrders}
              >
                {isRequestingBill ? "Gönderiliyor..." : "Hesap İste"}
              </button>
            </div>
          </section>
        </div>
      )}

      {selectedProduct && (
        <div
          className="product-modal-backdrop"
          role="presentation"
          onClick={closeProductModal}
        >
          <section
            className="product-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-detail-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="product-modal-close"
              type="button"
              onClick={closeProductModal}
              aria-label="Ürün detayını kapat"
            >
              X
            </button>
            <img
              className="product-modal-image"
              src={getProductImageUrl(selectedProduct)}
              alt={selectedProduct.name}
            />
            <div className="product-modal-body">
              <div>
                <h2 id="product-detail-title">{selectedProduct.name}</h2>
                <p className="product-modal-description">
                  {selectedProduct.description ||
                    "Şefin önerisi, masanız için taze hazırlanır."}
                </p>
              </div>

              <strong className="product-modal-price">
                ₺{selectedProduct.price}
              </strong>

              <dl className="product-detail-list">
                <div>
                  <dt>Kalori</dt>
                  <dd>{getProductDetailValue(selectedProduct, "calories")}</dd>
                </div>
                <div>
                  <dt>Alerjenler</dt>
                  <dd>{getProductDetailValue(selectedProduct, "allergens")}</dd>
                </div>
                <div>
                  <dt>İçindekiler</dt>
                  <dd>
                    {getProductIngredients(selectedProduct).length > 0
                      ? "Çıkarmak istediğiniz malzemelere dokunun"
                      : getProductDetailValue(selectedProduct, "ingredients")}
                  </dd>
                </div>
                <div>
                  <dt>Hazırlık</dt>
                  <dd>
                    {getProductDetailValue(
                      selectedProduct,
                      "estimatedPreparationMinutes",
                    )}
                  </dd>
                </div>
              </dl>

              {getProductIngredients(selectedProduct).length > 0 && (
                <div className="ingredient-picker">
                  <span>Çıkarılacak Malzemeler</span>
                  <div>
                    {getProductIngredients(selectedProduct).map((ingredient) => (
                      <button
                        className={
                          excludedIngredients.includes(ingredient)
                            ? "ingredient-chip excluded"
                            : "ingredient-chip"
                        }
                        key={ingredient}
                        type="button"
                        onClick={() => toggleExcludedIngredient(ingredient)}
                      >
                        {ingredient}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <label className="product-note-field">
                <span>Not</span>
                <textarea
                  value={modalNote}
                  onChange={(event) => setModalNote(event.target.value)}
                  placeholder="Mutfak için not ekleyin"
                />
              </label>

              <div className="product-modal-actions">
                <div className="modal-quantity-controls">
                  <button
                    type="button"
                    onClick={() =>
                      setModalQuantity((quantity) => Math.max(1, quantity - 1))
                    }
                  >
                    -
                  </button>
                  <span>{modalQuantity}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setModalQuantity((quantity) => quantity + 1)
                    }
                  >
                    +
                  </button>
                </div>
                <button type="button" onClick={addSelectedProductToCart}>
                  Sepete Ekle
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {showRatingModal && (
        <div
          className="rating-modal-backdrop"
          role="presentation"
          onClick={() => setShowRatingModal(false)}
        >
          <section
            className="rating-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rating-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="rating-modal-close"
              type="button"
              onClick={() => setShowRatingModal(false)}
              aria-label="Değerlendirmeyi kapat"
            >
              X
            </button>
            <p className="rating-kicker">Siparişiniz servis edildi</p>
            <h2 id="rating-modal-title">Deneyiminiz nasıldı?</h2>
            <p className="rating-helper">
              Geri bildiriminiz bir sonraki ziyaretinizi iyileştirmemize yardımcı olur.
            </p>

            <div className="rating-fields">
              {renderRatingInput("Hız", "★", speedRating, setSpeedRating)}
              {renderRatingInput(
                "Servis",
                "★",
                serviceRating,
                setServiceRating,
              )}
              {renderRatingInput("Lezzet", "★", tasteRating, setTasteRating)}
            </div>

            <label className="rating-comment-field">
              <span>Yorum</span>
              <textarea
                value={ratingComment}
                onChange={(event) => setRatingComment(event.target.value)}
                placeholder="Bize biraz daha anlatın..."
              />
            </label>

            {ratingError && <p className="rating-error">{ratingError}</p>}

            <button
              className="rating-submit-button"
              type="button"
              onClick={submitRating}
              disabled={isRatingSubmitting}
            >
              {isRatingSubmitting ? "Gönderiliyor..." : "Gönder"}
            </button>
          </section>
        </div>
      )}

      <footer className="customer-footer">
        <span>Desteğe mi ihtiyacınız var? Ekibimizi çağırabilirsiniz.</span>
        <span>Bizi tercih ettiğiniz için teşekkür ederiz.</span>
      </footer>
    </main>
  );
}
