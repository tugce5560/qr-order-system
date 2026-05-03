import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import api from "../../services/api";
import {
  onOrderCreated,
  onOrderUpdated,
  startOrderHubConnection,
} from "../../services/orderHub";
import type { OrderEventPayload } from "../../services/orderHub";
import { clearAuth } from "../../services/auth";
import { isDemoAuthBypassEnabled } from "../../services/demoAuth";
import "./AdminPage.css";

type Category = {
  id: number;
  name: string;
  displayOrder: number;
  isActive: boolean;
};

type Product = {
  id: number;
  categoryId: number;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  calories: number | null;
  allergens: string | null;
  ingredients: string | null;
  removableIngredients?: string | null;
  estimatedPreparationMinutes: number | null;
  isAvailable: boolean;
};

type RestaurantTable = {
  id: number;
  tableNumber: number;
  qrCodeUrl: string;
  isActive: boolean;
};

type Restaurant = {
  id: number;
  name: string;
  slug: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  menuBackgroundColor?: string | null;
  buttonColor?: string | null;
};

type AnalyticsSummary = {
  todayRevenue: number;
  todayOrderCount: number;
  openBillsCount: number;
  paidBillsCount: number;
  activeTablesCount: number;
  averageOrderValue: number;
  totalRevenueThisMonth: number;
  totalOrdersThisMonth: number;
  totalOrders: number;
  totalRevenue: number;
  avgPreparationTimeSeconds: number;
  avgServiceTimeSeconds: number;
  avgSpeed: number;
  avgTaste: number;
  avgService: number;
  totalRatings: number;
  topProducts: {
    name: string;
    totalSold: number;
  }[];
};

type TopProductAnalytics = {
  productId: number;
  productName: string;
  quantitySold: number;
  revenue: number;
};

type TablePerformanceAnalytics = {
  tableId: number;
  tableNumber: number;
  orderCount: number;
  revenue: number;
  lastOrderAt?: string | null;
};

type HourlyOrdersAnalytics = {
  hour: number;
  orderCount: number;
  revenue: number;
};

type MonthlySalesAnalytics = {
  month: number;
  revenue: number;
  orderCount: number;
};

type BillReceipt = {
  id: number;
  restaurantId: number;
  restaurantName: string;
  tableId: number;
  tableNumber: number;
  billNumber: string;
  status: string;
  subTotal: number;
  taxAmount: number;
  discountAmount: number;
  grandTotal: number;
  paymentMethod?: string | null;
  createdAt?: string;
  paidAt?: string | null;
  items: BillReceiptItem[];
};

type BillReceiptItem = {
  productName: string;
  quantity: number;
  unitPrice: number;
  removedIngredients?: string | null;
  lineTotal: number;
};

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

type AdminSection =
  | "dashboard"
  | "orders"
  | "menu"
  | "categories"
  | "products"
  | "tables"
  | "gallery"
  | "bills"
  | "analytics"
  | "reports"
  | "staff"
  | "settings";

type ProductFormState = {
  categoryId: string;
  name: string;
  description: string;
  price: string;
  imageUrl: string;
  calories: string;
  allergens: string;
  ingredients: string;
  removableIngredients: string;
  estimatedPreparationMinutes: string;
  isAvailable: boolean;
};

const appBaseUrl =
  import.meta.env.VITE_APP_BASE_URL || window.location.origin;

const adminNavItems: { id: AdminSection; label: string; icon: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: "DB" },
  { id: "orders", label: "Siparişler", icon: "OR" },
  { id: "menu", label: "Menü Yönetimi", icon: "MN" },
  { id: "categories", label: "Kategoriler", icon: "CT" },
  { id: "products", label: "Ürünler", icon: "PR" },
  { id: "gallery", label: "Görsel Galerisi", icon: "GL" },
  { id: "tables", label: "Masalar / QR Kodlar", icon: "QR" },
  { id: "bills", label: "Adisyonlar", icon: "AD" },
  { id: "analytics", label: "Analytics", icon: "AN" },
  { id: "reports", label: "Raporlar", icon: "RP" },
  { id: "staff", label: "Personel", icon: "PS" },
  { id: "settings", label: "Ayarlar", icon: "AY" },
];

const emptyProductForm: ProductFormState = {
  categoryId: "",
  name: "",
  description: "",
  price: "",
  imageUrl: "",
  calories: "",
  allergens: "",
  ingredients: "",
  removableIngredients: "",
  estimatedPreparationMinutes: "",
  isAvailable: true,
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatTime(value?: string) {
  if (!value) {
    return "Saat yok";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Kayıt yok";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDuration(seconds: number) {
  if (seconds <= 0) {
    return "0 dk";
  }

  return `${Math.round(seconds / 60)} dk`;
}

function getMonthLabel(month: number) {
  return new Intl.DateTimeFormat("tr-TR", { month: "short" }).format(
    new Date(Date.UTC(2026, month - 1, 1)),
  );
}

function toProductPayload(form: ProductFormState) {
  return {
    categoryId: Number(form.categoryId),
    name: form.name,
    description: form.description || null,
    price: Number(form.price),
    imageUrl: form.imageUrl || "",
    calories: form.calories ? Number(form.calories) : null,
    allergens: form.allergens || null,
    ingredients: form.ingredients || null,
    removableIngredients: form.removableIngredients || null,
    estimatedPreparationMinutes: form.estimatedPreparationMinutes
      ? Number(form.estimatedPreparationMinutes)
      : null,
    isAvailable: form.isAvailable,
  };
}

function productToForm(product: Product): ProductFormState {
  return {
    categoryId: String(product.categoryId),
    name: product.name,
    description: product.description ?? "",
    price: String(product.price),
    imageUrl: product.imageUrl ?? "",
    calories: product.calories === null ? "" : String(product.calories),
    allergens: product.allergens ?? "",
    ingredients: product.ingredients ?? "",
    removableIngredients: product.removableIngredients ?? "",
    estimatedPreparationMinutes:
      product.estimatedPreparationMinutes === null
        ? ""
        : String(product.estimatedPreparationMinutes),
    isAvailable: product.isAvailable,
  };
}

function getTableNumberFromOrder(order: Order, tables: RestaurantTable[]) {
  const match = order.orderNumber.match(/#?T(\d+)/i);

  if (match) {
    return match[1];
  }

  return String(
    tables.find((table) => table.id === order.tableId)?.tableNumber ??
      order.tableId,
  );
}

function AdminPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryDisplayOrder, setCategoryDisplayOrder] = useState("1");
  const [productForm, setProductForm] =
    useState<ProductFormState>(emptyProductForm);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [tableNumber, setTableNumber] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<AdminSection>(
    location.pathname.endsWith("/analytics") ? "analytics" : "dashboard",
  );
  const currentSection: AdminSection = location.pathname.endsWith("/analytics")
    ? "analytics"
    : activeSection;

  const activeOrders = orders.filter((order) =>
    ["New", "Preparing", "Ready"].includes(order.status),
  );
  const todayRevenue = orders.reduce(
    (total, order) => total + order.totalAmount,
    0,
  );
  const occupiedTableCount = new Set(activeOrders.map((order) => order.tableId))
    .size;
  const topProductName = analytics?.topProducts[0]?.name ?? "Veri yok";

  const reports = useMemo(() => {
    const monthlyRevenue = Math.max(analytics?.totalRevenue ?? 0, todayRevenue);

    return {
      dailySales: todayRevenue,
      monthlySales: monthlyRevenue,
      tableHistory: tables.map((table) => ({
        tableNumber: table.tableNumber,
        orders: orders.filter((order) => order.tableId === table.id).length,
        revenue: orders
          .filter((order) => order.tableId === table.id)
          .reduce((sum, order) => sum + order.totalAmount, 0),
      })),
    };
  }, [analytics?.totalRevenue, orders, tables, todayRevenue]);

  async function loadAdminData() {
    try {
      setIsLoading(true);
      setError(null);

      const [
        categoriesRes,
        productsRes,
        tablesRes,
        restaurantRes,
        analyticsRes,
        ordersRes,
      ] = await Promise.all([
        api.get<Category[]>("/admin/categories"),
        api.get<Product[]>("/admin/products"),
        api.get<RestaurantTable[]>("/admin/tables"),
        api.get<Restaurant>("/admin/restaurant"),
        api.get<AnalyticsSummary>("/analytics/summary"),
        api.get<Order[]>("/orders"),
      ]);

      setCategories(categoriesRes.data);
      setProducts(productsRes.data);
      setTables(tablesRes.data);
      setRestaurant(restaurantRes.data);
      setAnalytics(analyticsRes.data);
      setOrders(ordersRes.data);

      if (categoriesRes.data.length > 0) {
        setProductForm((currentForm) => ({
          ...currentForm,
          categoryId: currentForm.categoryId || String(categoriesRes.data[0].id),
        }));
      }
    } catch {
      setCategories([]);
      setProducts([]);
      setTables([]);
      setOrders([]);
      setRestaurant(null);
      setAnalytics(null);
      setError("Panel verileri yüklenemedi. API bağlantısını ve oturumunuzu kontrol edin.");
    } finally {
      setIsLoading(false);
    }
  }

  function mergeRealtimeOrder(orderEvent: OrderEventPayload) {
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
      void loadAdminData();
    }, 0);

    return () => window.clearTimeout(timeoutId);
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

  async function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextCategory: Category = {
      id: Date.now(),
      name: categoryName,
      displayOrder: Number(categoryDisplayOrder),
      isActive: true,
    };

    try {
      await api.post("/admin/categories", nextCategory);
      setCategoryName("");
      setCategoryDisplayOrder("1");
      await loadAdminData();
    } catch {
      setError("Kategori eklenemedi.");
    }
  }

  async function addProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = toProductPayload(productForm);

    try {
      await api.post("/admin/products", payload);
      setProductForm({
        ...emptyProductForm,
        categoryId: categories[0] ? String(categories[0].id) : "",
      });
      await loadAdminData();
    } catch {
      setError("Ürün eklenemedi.");
    }
  }

  async function saveProduct(productId: number) {
    const payload = toProductPayload(productForm);

    try {
      await api.put(`/admin/products/${productId}`, payload);
      setEditingProductId(null);
      await loadAdminData();
    } catch {
      setError("Ürün güncellenemedi.");
    }
  }

  async function deleteProduct(productId: number) {
    try {
      await api.delete(`/admin/products/${productId}`);
      await loadAdminData();
    } catch {
      setError("Ürün silinemedi.");
    }
  }

  async function toggleProduct(product: Product) {
    const payload = {
      ...product,
      isAvailable: !product.isAvailable,
    };

    try {
      await api.put(`/admin/products/${product.id}`, payload);
      await loadAdminData();
    } catch {
      setError("Ürün durumu güncellenemedi.");
    }
  }

  function getApiErrorMessage(error: unknown, fallback: string) {
    if (typeof error !== "object" || error === null || !("response" in error)) {
      return fallback;
    }

    const response = (error as { response?: { data?: unknown } }).response;

    if (typeof response?.data === "string") {
      return response.data;
    }

    if (typeof response?.data === "object" && response.data !== null) {
      if ("message" in response.data && typeof response.data.message === "string") {
        return response.data.message;
      }

      if ("title" in response.data && typeof response.data.title === "string") {
        return response.data.title;
      }

      if ("error" in response.data && typeof response.data.error === "string") {
        return response.data.error;
      }
    }

    return fallback;
  }

  async function addTable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextTableNumber = Number(tableNumber);

    if (nextTableNumber <= 0) {
      setError("Masa numarası sıfırdan büyük olmalı.");
      return;
    }

    if (tables.some((table) => table.tableNumber === nextTableNumber)) {
      setError("Bu masa numarası zaten mevcut.");
      return;
    }

    try {
      await api.post("/admin/tables", {
        tableNumber: nextTableNumber,
        qrCodeUrl: "",
      });
      setTableNumber("");
      await loadAdminData();
    } catch (error) {
      setError(getApiErrorMessage(error, "Masa eklenemedi."));
    }
  }

  async function deleteTable(tableId: number) {
    try {
      await api.delete(`/admin/tables/${tableId}`);
      await loadAdminData();
    } catch {
      setError("Masa silinemedi.");
    }
  }

  function getCategoryName(categoryId: number) {
    return (
      categories.find((category) => category.id === categoryId)?.name ||
      "Kategorisiz"
    );
  }

  function getQrPath(table: RestaurantTable) {
    return `/customer/r/${restaurant?.slug ?? "demo-restaurant"}/table/${
      table.tableNumber
    }`;
  }

  function getQrUrl(table: RestaurantTable) {
    return `${appBaseUrl}${getQrPath(table)}`;
  }

  async function copyQrLink(table: RestaurantTable) {
    await navigator.clipboard.writeText(getQrUrl(table));
    setNotice("QR linki kopyalandı.");
  }

  function openQrLink(table: RestaurantTable) {
    window.open(getQrUrl(table), "_blank", "noopener,noreferrer");
  }

  function downloadQrCode(table: RestaurantTable) {
    const canvas = document.getElementById(
      `table-${table.id}-qr`,
    ) as HTMLCanvasElement | null;

    if (canvas === null) {
      return;
    }

    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `masa-${table.tableNumber}-qr.png`;
    link.click();
  }

  function logout() {
    clearAuth();
    if (!isDemoAuthBypassEnabled()) {
      navigate("/login");
    }
  }

  async function saveTheme(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!restaurant) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const payload = {
      logoUrl: String(formData.get("logoUrl") ?? "") || null,
      primaryColor: String(formData.get("primaryColor") ?? "") || null,
      secondaryColor: String(formData.get("secondaryColor") ?? "") || null,
      accentColor: String(formData.get("accentColor") ?? "") || null,
      menuBackgroundColor:
        String(formData.get("menuBackgroundColor") ?? "") || null,
      buttonColor: String(formData.get("buttonColor") ?? "") || null,
    };

    try {
      await api.put("/admin/restaurant/theme", payload);
      setNotice("Tema ayarları kaydedildi.");
      await loadAdminData();
    } catch {
      setError("Tema ayarları kaydedilemedi.");
    }
  }

  async function uploadGalleryImage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fileInput = form.elements.namedItem("image") as HTMLInputElement | null;
    const file = fileInput?.files?.[0];

    if (!file) {
      setError("Yüklenecek görsel seçin.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await api.post<{ url: string }>("/admin/gallery", formData);
      setNotice(`Görsel yüklendi: ${response.data.url}`);
      form.reset();
    } catch {
      setError("Görsel yüklenemedi. jpg, jpeg, png veya webp kullanın.");
    }
  }

  function startEditingProduct(product: Product) {
    setEditingProductId(product.id);
    setProductForm(productToForm(product));
    setActiveSection("products");
  }

  function updateProductForm(field: keyof ProductFormState, value: string | boolean) {
    setProductForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  return (
    <main className="admin-dashboard-shell">
      <aside className="admin-sidebar" aria-label="Restaurant admin navigation">
        <div className="admin-sidebar-brand">
          <span>QR Order</span>
          <strong>Restaurant Admin</strong>
        </div>

        <nav className="admin-nav">
          {adminNavItems.map((item) => (
            <button
              className={currentSection === item.id ? "active" : ""}
              key={item.id}
              type="button"
              onClick={() => {
                setActiveSection(item.id);
                if (item.id === "analytics") {
                  navigate("/admin/analytics");
                } else if (location.pathname !== "/admin") {
                  navigate("/admin");
                }
              }}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <section className="admin-main">
        <header className="admin-header">
          <div>
            <p>Restaurant workspace</p>
            <h1>{restaurant?.name ?? "Restaurant Admin Panel"}</h1>
          </div>
          <div className="admin-header-actions">
            <button type="button" onClick={loadAdminData}>
              Yenile
            </button>
            <button type="button" onClick={logout}>
              Çıkış
            </button>
          </div>
        </header>

        {isLoading && (
          <section className="admin-skeleton-grid" aria-label="Panel yükleniyor">
            {[1, 2, 3, 4].map((item) => (
              <div className="admin-skeleton-card" key={item} />
            ))}
          </section>
        )}

        {!isLoading && notice && (
          <p className="admin-state-card admin-success">{notice}</p>
        )}

        {!isLoading && error && (
          <p className="admin-state-card admin-error">{error}</p>
        )}

        {!isLoading && currentSection === "dashboard" && (
          <section className="admin-section">
            <SectionHeading eyebrow="Genel bakış" title="Dashboard" />
            <div className="admin-analytics">
              <MetricCard label="Bugünkü satış" value={formatCurrency(todayRevenue)} />
              <MetricCard label="Aktif sipariş sayısı" value={activeOrders.length} />
              <MetricCard label="Dolu masa sayısı" value={occupiedTableCount} />
              <MetricCard label="En çok satılan ürün" value={topProductName} />
            </div>

            <div className="admin-dashboard-grid">
              <TopProductsPanel analytics={analytics} />
              <OrdersPanel
                orders={orders.slice(0, 5)}
                tables={tables}
                onSelectOrder={setSelectedOrder}
              />
            </div>
          </section>
        )}

        {!isLoading && currentSection === "orders" && (
          <section className="admin-section">
            <SectionHeading eyebrow="Operasyon" title="Siparişler" />
            <OrdersPanel
              orders={orders}
              tables={tables}
              onSelectOrder={setSelectedOrder}
            />
          </section>
        )}

        {!isLoading && currentSection === "menu" && (
          <section className="admin-section">
            <SectionHeading eyebrow="Katalog" title="Menü Yönetimi" />
            <div className="admin-menu-overview">
              <MetricCard label="Kategori" value={categories.length} />
              <MetricCard label="Ürün" value={products.length} />
              <MetricCard
                label="Aktif ürün"
                value={products.filter((product) => product.isAvailable).length}
              />
              <MetricCard
                label="Ortalama fiyat"
                value={formatCurrency(
                  products.length
                    ? products.reduce((sum, product) => sum + product.price, 0) /
                        products.length
                    : 0,
                )}
              />
            </div>
            <div className="admin-split-actions">
              <button type="button" onClick={() => setActiveSection("products")}>
                Ürünleri Yönet
              </button>
              <button type="button" onClick={() => setActiveSection("categories")}>
                Kategorileri Yönet
              </button>
            </div>
          </section>
        )}

        {!isLoading && currentSection === "categories" && (
          <section className="admin-section">
            <SectionHeading eyebrow="Menü yapısı" title="Kategoriler" />
            <section className="admin-panel">
              <PanelHeading eyebrow="Yeni kategori" title="Kategori ekle" />
              <form className="admin-form inline" onSubmit={addCategory}>
                <label>
                  <span>Kategori adı</span>
                  <input
                    value={categoryName}
                    onChange={(event) => setCategoryName(event.target.value)}
                    placeholder="Tatlılar"
                    required
                  />
                </label>
                <label>
                  <span>Sıralama</span>
                  <input
                    type="number"
                    value={categoryDisplayOrder}
                    onChange={(event) =>
                      setCategoryDisplayOrder(event.target.value)
                    }
                    required
                  />
                </label>
                <button type="submit">Kategori Ekle</button>
              </form>
            </section>
            <CategoryList categories={categories} />
          </section>
        )}

        {!isLoading && currentSection === "products" && (
          <section className="admin-section">
            <SectionHeading eyebrow="Menü içeriği" title="Ürünler" />
            <ProductEditor
              categories={categories}
              editingProductId={editingProductId}
              form={productForm}
              onCancel={() => {
                setEditingProductId(null);
                setProductForm({
                  ...emptyProductForm,
                  categoryId: categories[0] ? String(categories[0].id) : "",
                });
              }}
              onChange={updateProductForm}
              onCreate={addProduct}
              onSave={saveProduct}
            />
            <ProductList
              categories={categories}
              products={products}
              getCategoryName={getCategoryName}
              onDeleteProduct={deleteProduct}
              onEditProduct={startEditingProduct}
              onToggleProduct={toggleProduct}
            />
          </section>
        )}

        {!isLoading && currentSection === "tables" && (
          <section className="admin-section">
            <SectionHeading eyebrow="Misafir erişimi" title="Masalar / QR Kodlar" />
            <section className="admin-panel">
              <PanelHeading eyebrow="Yeni masa" title="Masa ekle" />
              <form className="admin-form inline" onSubmit={addTable}>
                <label>
                  <span>Masa numarası</span>
                  <input
                    type="number"
                    value={tableNumber}
                    onChange={(event) => setTableNumber(event.target.value)}
                    placeholder="12"
                    required
                  />
                </label>
                <button type="submit">Masa Ekle</button>
              </form>
            </section>
            <TablesPanel
              tables={tables}
              getQrUrl={getQrUrl}
              onCopyQr={copyQrLink}
              onDeleteTable={deleteTable}
              onDownloadQr={downloadQrCode}
              onOpenQr={openQrLink}
            />
          </section>
        )}

        {!isLoading && currentSection === "gallery" && (
          <section className="admin-section">
            <SectionHeading eyebrow="Medya" title="Görsel Galerisi" />
            <section className="admin-panel">
              <PanelHeading eyebrow="Yeni görsel" title="Fotoğraf yükle" />
              <form className="admin-form inline" onSubmit={uploadGalleryImage}>
                <label>
                  <span>Dosya</span>
                  <input
                    name="image"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    required
                  />
                </label>
                <button type="submit">Yükle</button>
              </form>
              <p className="admin-empty-state">
                Yüklenen URL'yi ürün formundaki Ürün görseli URL alanına
                yapıştırabilirsiniz.
              </p>
            </section>
          </section>
        )}

        {!isLoading && currentSection === "bills" && (
          <section className="admin-section">
            <SectionHeading eyebrow="Hesap takibi" title="Adisyonlar" />
            <BillsPanel
              orders={orders}
              restaurant={restaurant}
              onPaymentComplete={loadAdminData}
            />
          </section>
        )}

        {!isLoading && currentSection === "analytics" && (
          <section className="admin-section">
            <SectionHeading eyebrow="Performans" title="Analytics Dashboard" />
            <AnalyticsDashboard summary={analytics} />
          </section>
        )}

        {!isLoading && currentSection === "reports" && (
          <section className="admin-section">
            <SectionHeading eyebrow="Analiz" title="Raporlar" />
            <ReportsPanel
              analytics={analytics}
              reports={reports}
              tables={tables}
            />
          </section>
        )}

        {!isLoading && currentSection === "staff" && (
          <PlaceholderPanel
            eyebrow="Ekip"
            title="Personel"
            text="Personel rolleri ve vardiya yönetimi için hazır alan."
          />
        )}

        {!isLoading && currentSection === "settings" && (
          <section className="admin-section">
            <SectionHeading eyebrow="Restoran" title="Tema ve Logo Yönetimi" />
            <section className="admin-panel">
              <PanelHeading eyebrow="Görünüm" title="Görünüm Ayarları" />
              <form className="admin-form product-form" onSubmit={saveTheme}>
                <label className="wide">
                  <span>Logo URL</span>
                  <input
                    name="logoUrl"
                    defaultValue={restaurant?.logoUrl ?? ""}
                    placeholder="/uploads/restaurants/1/logo.png"
                  />
                </label>
                <label>
                  <span>Primary color</span>
                  <input
                    name="primaryColor"
                    type="color"
                    defaultValue={restaurant?.primaryColor ?? "#0f7d5d"}
                  />
                </label>
                <label>
                  <span>Secondary color</span>
                  <input
                    name="secondaryColor"
                    type="color"
                    defaultValue={restaurant?.secondaryColor ?? "#0a5f47"}
                  />
                </label>
                <label>
                  <span>Accent color</span>
                  <input
                    name="accentColor"
                    type="color"
                    defaultValue={restaurant?.accentColor ?? "#f4a640"}
                  />
                </label>
                <label>
                  <span>Menü arka planı</span>
                  <input
                    name="menuBackgroundColor"
                    type="color"
                    defaultValue={restaurant?.menuBackgroundColor ?? "#fbfaf6"}
                  />
                </label>
                <label>
                  <span>Buton rengi</span>
                  <input
                    name="buttonColor"
                    type="color"
                    defaultValue={restaurant?.buttonColor ?? "#0a5f47"}
                  />
                </label>
                <div className="admin-form-actions">
                  <button type="submit">Tema Ayarlarını Kaydet</button>
                </div>
              </form>
            </section>
          </section>
        )}

        {selectedOrder && (
          <OrderDetailModal
            order={selectedOrder}
            tableNumber={getTableNumberFromOrder(selectedOrder, tables)}
            onClose={() => setSelectedOrder(null)}
          />
        )}
      </section>
    </main>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="admin-section-heading">
      <div>
        <p>{eyebrow}</p>
        <h2>{title}</h2>
      </div>
    </div>
  );
}

function PanelHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="admin-panel-heading">
      <div>
        <p>{eyebrow}</p>
        <h3>{title}</h3>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number | string }) {
  return (
    <article className="admin-analytics-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function TopProductsPanel({
  analytics,
}: {
  analytics: AnalyticsSummary | null;
}) {
  return (
    <section className="admin-panel">
      <PanelHeading eyebrow="Satış içgörüsü" title="En çok satan ürünler" />
      {analytics?.topProducts.length ? (
        <ol className="admin-ranked-list">
          {analytics.topProducts.map((product, index) => (
            <li key={`${product.name}-${index}`}>
              <span>{index + 1}</span>
              <strong>{product.name}</strong>
              <em>{product.totalSold} adet</em>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState text="Henüz ürün satışı yok." />
      )}
    </section>
  );
}

function OrdersPanel({
  orders,
  tables,
  onSelectOrder,
}: {
  orders: Order[];
  tables: RestaurantTable[];
  onSelectOrder: (order: Order) => void;
}) {
  return (
    <section className="admin-panel">
      <PanelHeading eyebrow="Sipariş yönetimi" title="Siparişler" />
      {orders.length === 0 ? (
        <EmptyState text="Henüz sipariş yok." />
      ) : (
        <div className="admin-data-table admin-orders-table">
          {orders.map((order) => (
            <article key={order.id}>
              <span>Masa {getTableNumberFromOrder(order, tables)}</span>
              <strong>{order.status}</strong>
              <b>{formatCurrency(order.totalAmount)}</b>
              <time>{formatTime(order.createdAt)}</time>
              <button type="button" onClick={() => onSelectOrder(order)}>
                Detay
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function CategoryList({ categories }: { categories: Category[] }) {
  return (
    <section className="admin-panel">
      <PanelHeading eyebrow="Liste" title="Kategoriler" />
      {categories.length === 0 ? (
        <EmptyState text="Henüz kategori yok." />
      ) : (
        <div className="admin-card-list">
          {categories.map((category) => (
            <article key={category.id}>
              <div>
                <h4>{category.name}</h4>
                <p>Sıra {category.displayOrder}</p>
              </div>
              <span>{category.isActive ? "Aktif" : "Pasif"}</span>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function ProductEditor({
  categories,
  editingProductId,
  form,
  onCancel,
  onChange,
  onCreate,
  onSave,
}: {
  categories: Category[];
  editingProductId: number | null;
  form: ProductFormState;
  onCancel: () => void;
  onChange: (field: keyof ProductFormState, value: string | boolean) => void;
  onCreate: (event: FormEvent<HTMLFormElement>) => void;
  onSave: (productId: number) => void;
}) {
  return (
    <section className="admin-panel">
      <PanelHeading
        eyebrow={editingProductId ? "Düzenle" : "Yeni ürün"}
        title={editingProductId ? "Ürün düzenle" : "Ürün ekle"}
      />
      <form
        className="admin-form product-form"
        onSubmit={(event) => {
          event.preventDefault();

          if (editingProductId) {
            onSave(editingProductId);
            return;
          }

          onCreate(event);
        }}
      >
        <label>
          <span>Kategori</span>
          <select
            value={form.categoryId}
            onChange={(event) => onChange("categoryId", event.target.value)}
            required
          >
            <option value="">Kategori seç</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Ürün adı</span>
          <input
            value={form.name}
            onChange={(event) => onChange("name", event.target.value)}
            placeholder="Ürün adı"
            required
          />
        </label>
        <label>
          <span>Fiyat</span>
          <input
            type="number"
            value={form.price}
            onChange={(event) => onChange("price", event.target.value)}
            placeholder="250"
            required
          />
        </label>
        <label>
          <span>Ürün görseli URL</span>
          <input
            value={form.imageUrl}
            onChange={(event) => onChange("imageUrl", event.target.value)}
            placeholder="https://..."
          />
        </label>
        <label className="wide">
          <span>Açıklama</span>
          <textarea
            value={form.description}
            onChange={(event) => onChange("description", event.target.value)}
            placeholder="Menüde görünecek kısa açıklama"
          />
        </label>
        <label>
          <span>Kalori</span>
          <input
            type="number"
            value={form.calories}
            onChange={(event) => onChange("calories", event.target.value)}
            placeholder="620"
          />
        </label>
        <label>
          <span>Hazırlık süresi</span>
          <input
            type="number"
            value={form.estimatedPreparationMinutes}
            onChange={(event) =>
              onChange("estimatedPreparationMinutes", event.target.value)
            }
            placeholder="12"
          />
        </label>
        <label className="wide">
          <span>İçerik</span>
          <input
            value={form.ingredients}
            onChange={(event) => onChange("ingredients", event.target.value)}
            placeholder="Dana köfte, cheddar, ekmek"
          />
        </label>
        <label className="wide">
          <span>Çıkarılabilir malzemeler</span>
          <input
            value={form.removableIngredients}
            onChange={(event) =>
              onChange("removableIngredients", event.target.value)
            }
            placeholder="Soğan, domates, turşu, acı sos"
          />
        </label>
        <label className="wide">
          <span>Alerjenler</span>
          <input
            value={form.allergens}
            onChange={(event) => onChange("allergens", event.target.value)}
            placeholder="Gluten, süt ürünü"
          />
        </label>
        <label className="admin-toggle">
          <input
            type="checkbox"
            checked={form.isAvailable}
            onChange={(event) => onChange("isAvailable", event.target.checked)}
          />
          <span>Ürün aktif</span>
        </label>
        <div className="admin-form-actions">
          {editingProductId && (
            <button type="button" onClick={onCancel}>
              Vazgeç
            </button>
          )}
          <button type="submit">
            {editingProductId ? "Ürünü Güncelle" : "Ürün Ekle"}
          </button>
        </div>
      </form>
    </section>
  );
}

function ProductList({
  products,
  getCategoryName,
  onDeleteProduct,
  onEditProduct,
  onToggleProduct,
}: {
  categories: Category[];
  products: Product[];
  getCategoryName: (categoryId: number) => string;
  onDeleteProduct: (productId: number) => void;
  onEditProduct: (product: Product) => void;
  onToggleProduct: (product: Product) => void;
}) {
  return (
    <section className="admin-panel">
      <PanelHeading eyebrow="Liste" title="Ürünler" />
      {products.length === 0 ? (
        <EmptyState text="Henüz ürün yok." />
      ) : (
        <div className="admin-product-grid">
          {products.map((product) => (
            <article className="admin-product-card" key={product.id}>
              <div className="admin-product-image">
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt="" />
                ) : (
                  <span>{product.name.slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <div>
                <span>{getCategoryName(product.categoryId)}</span>
                <h4>{product.name}</h4>
                <p>{product.description || "Açıklama yok"}</p>
              </div>
              <dl>
                <div>
                  <dt>Fiyat</dt>
                  <dd>{formatCurrency(product.price)}</dd>
                </div>
                <div>
                  <dt>Kalori</dt>
                  <dd>{product.calories ?? "-"} kcal</dd>
                </div>
                <div>
                  <dt>Süre</dt>
                  <dd>{product.estimatedPreparationMinutes ?? "-"} dk</dd>
                </div>
              </dl>
              <p>{product.ingredients || "İçerik bilgisi yok"}</p>
              <p>{product.allergens || "Alerjen bilgisi yok"}</p>
              <div className="admin-row-actions">
                <button type="button" onClick={() => onEditProduct(product)}>
                  Düzenle
                </button>
                <button type="button" onClick={() => onToggleProduct(product)}>
                  {product.isAvailable ? "Pasif Yap" : "Aktif Yap"}
                </button>
                <button type="button" onClick={() => onDeleteProduct(product.id)}>
                  Sil
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function TablesPanel({
  tables,
  getQrUrl,
  onCopyQr,
  onDeleteTable,
  onDownloadQr,
  onOpenQr,
}: {
  tables: RestaurantTable[];
  getQrUrl: (table: RestaurantTable) => string;
  onCopyQr: (table: RestaurantTable) => void;
  onDeleteTable: (tableId: number) => void;
  onDownloadQr: (table: RestaurantTable) => void;
  onOpenQr: (table: RestaurantTable) => void;
}) {
  return tables.length === 0 ? (
    <EmptyState text="Henüz masa oluşturulmadı." />
  ) : (
    <div className="qr-card-grid">
      {tables.map((table) => (
        <article className="qr-card" key={table.id}>
          <div className="qr-card-top">
            <div>
              <p>Masa</p>
              <h3>{table.tableNumber}</h3>
            </div>
            <span>{table.isActive ? "Aktif" : "Pasif"}</span>
          </div>
          <div className="qr-code-box">
            <QRCodeCanvas
              id={`table-${table.id}-qr`}
              value={getQrUrl(table)}
              size={168}
              level="M"
              includeMargin
            />
          </div>
          <p className="qr-url">{getQrUrl(table)}</p>
          <div className="qr-actions">
            <button type="button" onClick={() => onCopyQr(table)}>
              Link Kopyala
            </button>
            <button type="button" onClick={() => onOpenQr(table)}>
              Menüyü Aç
            </button>
            <button type="button" onClick={() => onDownloadQr(table)}>
              QR İndir
            </button>
            <button type="button" onClick={() => onDeleteTable(table.id)}>
              Sil
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function BillsPanel({
  onPaymentComplete,
  orders,
  restaurant,
}: {
  onPaymentComplete: () => Promise<void>;
  orders: Order[];
  restaurant: Restaurant | null;
}) {
  const [receipts, setReceipts] = useState<BillReceipt[]>([]);
  const [isLoadingBills, setIsLoadingBills] = useState(false);
  const [billError, setBillError] = useState<string | null>(null);
  const [payingTableId, setPayingTableId] = useState<number | null>(null);
  const openBillTableIds = useMemo(
    () =>
      Array.from(
        new Set(
          orders
            .filter((order) => !["Paid", "Cancelled"].includes(order.status))
            .map((order) => order.tableId),
        ),
      ),
    [orders],
  );

  useEffect(() => {
    async function loadBills() {
      if (!restaurant || openBillTableIds.length === 0) {
        setReceipts([]);
        setBillError(null);
        return;
      }

      try {
        setIsLoadingBills(true);
        setBillError(null);

        const responses = await Promise.allSettled(
          openBillTableIds.map((tableId) =>
            api.get<BillReceipt>(`/payments/tables/${tableId}/bill`, {
              params: { restaurantId: restaurant.id },
            }),
          ),
        );

        setReceipts(
          responses
            .filter((response) => response.status === "fulfilled")
            .map((response) => response.value.data)
            .filter((receipt) => receipt.status !== "Paid")
            .sort((firstReceipt, secondReceipt) =>
              firstReceipt.tableNumber - secondReceipt.tableNumber,
            ),
        );
      } catch {
        setBillError("Adisyonlar yüklenemedi.");
      } finally {
        setIsLoadingBills(false);
      }
    }

    void loadBills();
  }, [openBillTableIds, restaurant]);

  async function payBill(receipt: BillReceipt) {
    if (!restaurant) {
      return;
    }

    try {
      setPayingTableId(receipt.tableId);
      setBillError(null);

      await api.post("/payments/pay", {
        restaurantId: restaurant.id,
        tableId: receipt.tableId,
        paymentMethod: "Card",
      });

      await onPaymentComplete();
    } catch {
      setBillError("Ödeme alınamadı.");
    } finally {
      setPayingTableId(null);
    }
  }

  return (
    <section className="admin-panel">
      <PanelHeading eyebrow="Açık hesaplar" title="Adisyon listesi" />
      {billError && <p className="admin-state-card admin-error">{billError}</p>}
      {isLoadingBills ? (
        <p className="admin-state-card">Adisyonlar yükleniyor...</p>
      ) : receipts.length === 0 ? (
        <EmptyState text="Adisyon bekleyen sipariş yok." />
      ) : (
        <div className="admin-bill-list">
          {receipts.map((receipt) => (
            <article className="admin-bill-card" key={receipt.id}>
              <div className="admin-bill-card-head">
                <div>
                  <span>Masa {receipt.tableNumber}</span>
                  <strong>{receipt.billNumber}</strong>
                </div>
                <em>{receipt.status === "Open" ? "Ödeme bekliyor" : receipt.status}</em>
              </div>

              <div className="admin-bill-items">
                {receipt.items.map((item) => (
                  <div key={`${receipt.id}-${item.productName}-${item.unitPrice}`}>
                    <span>
                      {item.quantity}x {item.productName}
                      {item.removedIngredients && (
                        <small>Çıkarılanlar: {item.removedIngredients}</small>
                      )}
                    </span>
                    <b>{formatCurrency(item.lineTotal)}</b>
                  </div>
                ))}
              </div>

              <dl className="admin-bill-totals">
                <div>
                  <dt>Ara toplam</dt>
                  <dd>{formatCurrency(receipt.subTotal)}</dd>
                </div>
                <div>
                  <dt>Vergi</dt>
                  <dd>{formatCurrency(receipt.taxAmount)}</dd>
                </div>
                <div>
                  <dt>İndirim</dt>
                  <dd>{formatCurrency(receipt.discountAmount)}</dd>
                </div>
                <div>
                  <dt>Genel toplam</dt>
                  <dd>{formatCurrency(receipt.grandTotal)}</dd>
                </div>
              </dl>

              <div className="admin-row-actions">
                <button type="button" onClick={() => window.print()}>
                  Adisyon Yazdır
                </button>
                <button
                  type="button"
                  onClick={() => payBill(receipt)}
                  disabled={payingTableId === receipt.tableId}
                >
                  {payingTableId === receipt.tableId
                    ? "İşleniyor..."
                    : "Ödeme Al / Ödendi İşaretle"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function AnalyticsDashboard({ summary }: { summary: AnalyticsSummary | null }) {
  const [topProducts, setTopProducts] = useState<TopProductAnalytics[]>([]);
  const [tablePerformance, setTablePerformance] = useState<
    TablePerformanceAnalytics[]
  >([]);
  const [hourlyOrders, setHourlyOrders] = useState<HourlyOrdersAnalytics[]>([]);
  const [monthlySales, setMonthlySales] = useState<MonthlySalesAnalytics[]>([]);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(true);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const selectedYear = new Date().getUTCFullYear();

  useEffect(() => {
    async function loadAnalytics() {
      try {
        setIsLoadingAnalytics(true);
        setAnalyticsError(null);

        const [productsRes, tablesRes, hourlyRes, monthlyRes] = await Promise.all([
          api.get<TopProductAnalytics[]>("/analytics/top-products", {
            params: { limit: 5 },
          }),
          api.get<TablePerformanceAnalytics[]>("/analytics/table-performance"),
          api.get<HourlyOrdersAnalytics[]>("/analytics/hourly-orders"),
          api.get<MonthlySalesAnalytics[]>("/analytics/monthly-sales", {
            params: { year: selectedYear },
          }),
        ]);

        setTopProducts(productsRes.data);
        setTablePerformance(tablesRes.data);
        setHourlyOrders(hourlyRes.data);
        setMonthlySales(monthlyRes.data);
      } catch {
        setAnalyticsError("Analytics verileri yüklenemedi.");
      } finally {
        setIsLoadingAnalytics(false);
      }
    }

    void loadAnalytics();
  }, [selectedYear]);

  if (isLoadingAnalytics) {
    return (
      <section className="admin-analytics-loading" aria-label="Analytics yükleniyor">
        {[1, 2, 3, 4].map((item) => (
          <div className="admin-skeleton-card" key={item} />
        ))}
      </section>
    );
  }

  if (analyticsError) {
    return <p className="admin-state-card admin-error">{analyticsError}</p>;
  }

  const maxProductRevenue = Math.max(
    1,
    ...topProducts.map((product) => product.revenue),
  );
  const maxTableRevenue = Math.max(
    1,
    ...tablePerformance.map((table) => table.revenue),
  );
  const maxHourlyOrders = Math.max(
    1,
    ...hourlyOrders.map((item) => item.orderCount),
  );
  const maxMonthlyRevenue = Math.max(
    1,
    ...monthlySales.map((item) => item.revenue),
  );

  return (
    <>
      <div className="admin-analytics-metrics">
        <MetricCard
          label="Bugünkü Ciro"
          value={formatCurrency(summary?.todayRevenue ?? 0)}
        />
        <MetricCard
          label="Bugünkü Sipariş"
          value={summary?.todayOrderCount ?? 0}
        />
        <MetricCard
          label="Açık Adisyon"
          value={summary?.openBillsCount ?? 0}
        />
        <MetricCard
          label="Ödenmiş Adisyon"
          value={summary?.paidBillsCount ?? 0}
        />
        <MetricCard
          label="Aktif Masa"
          value={summary?.activeTablesCount ?? 0}
        />
        <MetricCard
          label="Ortalama Sipariş"
          value={formatCurrency(summary?.averageOrderValue ?? 0)}
        />
        <MetricCard
          label="Bu Ayki Ciro"
          value={formatCurrency(summary?.totalRevenueThisMonth ?? 0)}
        />
        <MetricCard
          label="Bu Ayki Sipariş"
          value={summary?.totalOrdersThisMonth ?? 0}
        />
      </div>

      <div className="admin-analytics-grid">
        <section className="admin-panel analytics-panel">
          <PanelHeading eyebrow="Ürün performansı" title="En Çok Satan Ürünler" />
          {topProducts.length === 0 ? (
            <EmptyState text="Bu aralıkta ürün satışı yok." />
          ) : (
            <div className="analytics-bars">
              {topProducts.map((product, index) => (
                <article key={product.productId}>
                  <div>
                    <span>{index + 1}</span>
                    <strong>{product.productName}</strong>
                    <em>{product.quantitySold} adet</em>
                  </div>
                  <div className="analytics-bar-track">
                    <i
                      style={{
                        width: `${Math.max(
                          6,
                          (product.revenue / maxProductRevenue) * 100,
                        )}%`,
                      }}
                    />
                  </div>
                  <b>{formatCurrency(product.revenue)}</b>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="admin-panel analytics-panel">
          <PanelHeading eyebrow="Masa performansı" title="Masa Bazlı Gelir" />
          {tablePerformance.length === 0 ? (
            <EmptyState text="Masa performansı için ödenmiş sipariş yok." />
          ) : (
            <div className="analytics-table-list">
              {tablePerformance.map((table) => (
                <article key={table.tableId}>
                  <div>
                    <strong>Masa {table.tableNumber}</strong>
                    <span>
                      {table.orderCount} sipariş · Son:{" "}
                      {formatDateTime(table.lastOrderAt)}
                    </span>
                  </div>
                  <div className="analytics-bar-track">
                    <i
                      style={{
                        width: `${Math.max(
                          6,
                          (table.revenue / maxTableRevenue) * 100,
                        )}%`,
                      }}
                    />
                  </div>
                  <b>{formatCurrency(table.revenue)}</b>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="admin-panel analytics-panel wide">
          <PanelHeading eyebrow="Bugün" title="Saatlik Sipariş Yoğunluğu" />
          <div className="analytics-hour-chart">
            {hourlyOrders.map((item) => (
              <div key={item.hour}>
                <span
                  style={{
                    height: `${Math.max(8, (item.orderCount / maxHourlyOrders) * 100)}%`,
                  }}
                  title={`${item.hour}:00 · ${item.orderCount} sipariş`}
                />
                <small>{String(item.hour).padStart(2, "0")}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-panel analytics-panel wide">
          <PanelHeading eyebrow={String(selectedYear)} title="Aylık Satış Grafiği" />
          <div className="analytics-month-chart">
            {monthlySales.map((item) => (
              <article key={item.month}>
                <span>{getMonthLabel(item.month)}</span>
                <div className="analytics-bar-track">
                  <i
                    style={{
                      width: `${Math.max(
                        4,
                        (item.revenue / maxMonthlyRevenue) * 100,
                      )}%`,
                    }}
                  />
                </div>
                <strong>{formatCurrency(item.revenue)}</strong>
                <em>{item.orderCount} sipariş</em>
              </article>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function ReportsPanel({
  analytics,
  reports,
}: {
  analytics: AnalyticsSummary | null;
  reports: {
    dailySales: number;
    monthlySales: number;
    tableHistory: { tableNumber: number; orders: number; revenue: number }[];
  };
  tables: RestaurantTable[];
}) {
  return (
    <>
      <div className="admin-analytics">
        <MetricCard label="Günlük satış özeti" value={formatCurrency(reports.dailySales)} />
        <MetricCard label="Aylık satış özeti" value={formatCurrency(reports.monthlySales)} />
        <MetricCard
          label="Ortalama hazırlık"
          value={formatDuration(analytics?.avgPreparationTimeSeconds ?? 0)}
        />
        <MetricCard label="Değerlendirme" value={`${analytics?.avgTaste ?? 0}/5`} />
      </div>
      <div className="admin-dashboard-grid">
        <TopProductsPanel analytics={analytics} />
        <section className="admin-panel">
          <PanelHeading eyebrow="Masa geçmişi" title="Masa bazlı sipariş geçmişi" />
          {reports.tableHistory.length === 0 ? (
            <EmptyState text="Masa bazlı geçmiş yok." />
          ) : (
            <div className="admin-data-table">
              {reports.tableHistory.map((row) => (
                <article key={row.tableNumber}>
                  <span>Masa {row.tableNumber}</span>
                  <strong>{row.orders} sipariş</strong>
                  <b>{formatCurrency(row.revenue)}</b>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function PlaceholderPanel({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <section className="admin-section">
      <SectionHeading eyebrow={eyebrow} title={title} />
      <section className="admin-panel admin-placeholder">
        <span>{title.slice(0, 2).toUpperCase()}</span>
        <h3>{title}</h3>
        <p>{text}</p>
      </section>
    </section>
  );
}

function OrderDetailModal({
  order,
  tableNumber,
  onClose,
}: {
  order: Order;
  tableNumber: string;
  onClose: () => void;
}) {
  return (
    <div className="admin-modal-backdrop" role="presentation">
      <section className="admin-modal" role="dialog" aria-modal="true">
        <header>
          <div>
            <span>Masa {tableNumber}</span>
            <h3>{order.orderNumber}</h3>
          </div>
          <button type="button" onClick={onClose}>
            Kapat
          </button>
        </header>
        <dl>
          <div>
            <dt>Durum</dt>
            <dd>{order.status}</dd>
          </div>
          <div>
            <dt>Toplam</dt>
            <dd>{formatCurrency(order.totalAmount)}</dd>
          </div>
          <div>
            <dt>Saat</dt>
            <dd>{formatTime(order.createdAt)}</dd>
          </div>
        </dl>
        <ul>
          {order.items.map((item) => (
            <li key={item.id}>
              <span>{item.productName}</span>
              {item.removedIngredients && (
                <em>Çıkarılanlar: {item.removedIngredients}</em>
              )}
              {item.note && <em>Not: {item.note}</em>}
              <strong>x{item.quantity}</strong>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="admin-empty-state">{text}</p>;
}

export default AdminPage;
