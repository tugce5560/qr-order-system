import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import api from "../../services/api";
import "./SuperAdminPage.css";

type SuperAdminSection =
  | "dashboard"
  | "restaurants"
  | "subscriptions"
  | "users"
  | "reports"
  | "settings";

type SubscriptionPlan = "Basic" | "Pro" | "Premium";
type RestaurantStatus = "Active" | "Inactive" | "Trial";
type UserRole = "Owner" | "Admin" | "Manager" | "Support";

type RestaurantAccount = {
  id: number;
  name: string;
  slug: string;
  city: string;
  status: RestaurantStatus;
  plan: SubscriptionPlan;
  subscriptionEndsAt: string;
  adminUser: string;
  orders: number;
  revenue: number;
};

type SuperAdminUser = {
  id: number;
  name: string;
  email: string;
  restaurantName: string;
  role: UserRole;
  status: "Active" | "Invited";
};

type PlatformReport = {
  label: string;
  orders: number;
  revenue: number;
};

type SuperAdminPayload = {
  restaurants: RestaurantAccount[];
  users: SuperAdminUser[];
  reports: PlatformReport[];
};

const navItems: { id: SuperAdminSection; label: string; icon: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: "DB" },
  { id: "restaurants", label: "Restoranlar", icon: "RS" },
  { id: "subscriptions", label: "Abonelikler", icon: "AB" },
  { id: "users", label: "Kullanıcılar", icon: "KU" },
  { id: "reports", label: "Sistem Raporları", icon: "RP" },
  { id: "settings", label: "Ayarlar", icon: "AY" },
];

const planPrices: Record<SubscriptionPlan, number> = {
  Basic: 799,
  Pro: 1499,
  Premium: 2999,
};

const demoSuperAdminData: SuperAdminPayload = {
  restaurants: [
    {
      id: 1,
      name: "Limon Cafe",
      slug: "limon-cafe",
      city: "İstanbul",
      status: "Active",
      plan: "Premium",
      subscriptionEndsAt: "2026-12-31",
      adminUser: "Limon Cafe Admin",
      orders: 184,
      revenue: 64250,
    },
    {
      id: 2,
      name: "Kuzey Grill",
      slug: "kuzey-grill",
      city: "Ankara",
      status: "Active",
      plan: "Pro",
      subscriptionEndsAt: "2026-11-15",
      adminUser: "Kuzey Operasyon",
      orders: 132,
      revenue: 48740,
    },
    {
      id: 3,
      name: "Mavi Masa Bistro",
      slug: "mavi-masa-bistro",
      city: "İzmir",
      status: "Trial",
      plan: "Basic",
      subscriptionEndsAt: "2026-06-30",
      adminUser: "Bistro Admin",
      orders: 76,
      revenue: 21980,
    },
  ],
  users: [
    { id: 1, name: "Tuğçe Admin", email: "admin@test.com", restaurantName: "Limon Cafe", role: "Owner", status: "Active" },
    { id: 2, name: "Mutfak Ekibi", email: "kitchen@test.com", restaurantName: "Kuzey Grill", role: "Manager", status: "Active" },
    { id: 3, name: "Garson Ekibi", email: "waiter@test.com", restaurantName: "Mavi Masa Bistro", role: "Support", status: "Invited" },
  ],
  reports: [
    { label: "Bugün", orders: 38, revenue: 12840 },
    { label: "Bu Hafta", orders: 214, revenue: 73950 },
    { label: "Bu Ay", orders: 612, revenue: 198240 },
  ],
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function getSlugFromName(name: string) {
  return name
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replaceAll("ı", "i")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ş", "s")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function SuperAdminPage() {
  const [activeSection, setActiveSection] =
    useState<SuperAdminSection>("dashboard");
  const [restaurants, setRestaurants] = useState<RestaurantAccount[]>([]);
  const [users, setUsers] = useState<SuperAdminUser[]>([]);
  const [reports, setReports] = useState<PlatformReport[]>([]);
  const [query, setQuery] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [restaurantCity, setRestaurantCity] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>("Basic");
  const [editingRestaurantId, setEditingRestaurantId] = useState<number | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const totals = useMemo(() => {
    return restaurants.reduce(
      (summary, restaurant) => ({
        restaurantCount: summary.restaurantCount + 1,
        activeRestaurantCount:
          summary.activeRestaurantCount + (restaurant.status === "Active" ? 1 : 0),
        totalOrders: summary.totalOrders + restaurant.orders,
        totalRevenue: summary.totalRevenue + restaurant.revenue,
      }),
      {
        restaurantCount: 0,
        activeRestaurantCount: 0,
        totalOrders: 0,
        totalRevenue: 0,
      },
    );
  }, [restaurants]);

  const filteredRestaurants = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR");

    if (!normalizedQuery) {
      return restaurants;
    }

    return restaurants.filter((restaurant) =>
      [
        restaurant.name,
        restaurant.city,
        restaurant.status,
        restaurant.plan,
        restaurant.adminUser,
      ]
        .join(" ")
        .toLocaleLowerCase("tr-TR")
        .includes(normalizedQuery),
    );
  }, [query, restaurants]);

  const mrr = restaurants.reduce(
    (total, restaurant) =>
      restaurant.status === "Active" ? total + planPrices[restaurant.plan] : total,
    0,
  );

  useEffect(() => {
    loadSuperAdminData();
  }, []);

  async function loadSuperAdminData() {
    try {
      setIsLoading(true);
      setError(null);

      const response = await api.get<SuperAdminPayload>("/super-admin/overview");
      setRestaurants(response.data.restaurants);
      setUsers(response.data.users);
      setReports(response.data.reports);
    } catch {
      setError(null);
      setRestaurants(demoSuperAdminData.restaurants);
      setUsers(demoSuperAdminData.users);
      setReports(demoSuperAdminData.reports);
    } finally {
      setIsLoading(false);
    }
  }

  async function saveRestaurant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload: RestaurantAccount = {
      id: editingRestaurantId ?? Date.now(),
      name: restaurantName,
      slug: getSlugFromName(restaurantName),
      city: restaurantCity,
      status: "Active",
      plan: selectedPlan,
      subscriptionEndsAt: "2026-12-31",
      adminUser: "Yeni Admin",
      orders: 0,
      revenue: 0,
    };

    try {
      if (editingRestaurantId === null) {
        await api.post("/super-admin/restaurants", payload);
      } else {
        await api.put(`/super-admin/restaurants/${editingRestaurantId}`, payload);
      }

      resetRestaurantForm();
      setNotice(editingRestaurantId ? "Restoran güncellendi." : "Restoran eklendi.");
      await loadSuperAdminData();
    } catch {
      setError("Restoran kaydedilemedi.");
    }
  }

  async function toggleRestaurant(restaurant: RestaurantAccount) {
    const nextStatus: RestaurantStatus =
      restaurant.status === "Active" ? "Inactive" : "Active";

    try {
      await api.patch(`/super-admin/restaurants/${restaurant.id}/status`, {
        status: nextStatus,
      });
      setNotice("Restoran durumu güncellendi.");
      await loadSuperAdminData();
    } catch {
      setError("Restoran durumu güncellenemedi.");
    }
  }

  async function updateRestaurantPlan(
    restaurant: RestaurantAccount,
    plan: SubscriptionPlan,
  ) {
    try {
      await api.patch(`/super-admin/restaurants/${restaurant.id}/plan`, { plan });
      setNotice("Abonelik planı güncellendi.");
      await loadSuperAdminData();
    } catch {
      setError("Abonelik planı güncellenemedi.");
    }
  }

  function startEditingRestaurant(restaurant: RestaurantAccount) {
    setEditingRestaurantId(restaurant.id);
    setRestaurantName(restaurant.name);
    setRestaurantCity(restaurant.city);
    setSelectedPlan(restaurant.plan);
    setActiveSection("restaurants");
  }

  function resetRestaurantForm() {
    setEditingRestaurantId(null);
    setRestaurantName("");
    setRestaurantCity("");
    setSelectedPlan("Basic");
  }

  return (
    <main className="super-admin-shell">
      <aside className="super-admin-sidebar" aria-label="Super admin navigation">
        <div className="super-admin-brand">
          <span>QR Order</span>
          <strong>Super Admin</strong>
        </div>

        <nav className="super-admin-nav">
          {navItems.map((item) => (
            <button
              className={activeSection === item.id ? "active" : ""}
              key={item.id}
              type="button"
              onClick={() => setActiveSection(item.id)}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <section className="super-admin-sidebar-panel">
          <span>Platform durumu</span>
          <strong>Operational</strong>
          <p>QR, sipariş ve restoran yönetimi servisleri izleniyor.</p>
        </section>
      </aside>

      <section className="super-admin-main">
        <header className="super-admin-header">
          <div>
            <p>SaaS yönetimi</p>
            <h1>Super Admin Panel</h1>
          </div>
          <div className="super-admin-header-actions">
            <button type="button" onClick={loadSuperAdminData}>
              Yenile
            </button>
          </div>
        </header>

        {isLoading && (
          <section className="super-admin-skeleton-grid" aria-label="Yükleniyor">
            {[1, 2, 3, 4].map((item) => (
              <div className="super-admin-skeleton-card" key={item} />
            ))}
          </section>
        )}

        {!isLoading && notice && (
          <p className="super-admin-state success">{notice}</p>
        )}

        {!isLoading && error && (
          <p className="super-admin-state error">{error}</p>
        )}

        {!isLoading && activeSection === "dashboard" && (
          <section className="super-admin-section">
            <SectionHeading eyebrow="Canlı özet" title="Dashboard" />
            <div className="super-admin-metrics">
              <MetricCard label="Toplam restoran sayısı" value={totals.restaurantCount} />
              <MetricCard
                label="Aktif restoran sayısı"
                value={totals.activeRestaurantCount}
              />
              <MetricCard
                label="Toplam sipariş sayısı"
                value={totals.totalOrders.toLocaleString("tr-TR")}
              />
              <MetricCard
                label="Toplam gelir"
                value={formatCurrency(totals.totalRevenue)}
              />
            </div>

            <div className="super-admin-overview-grid">
              <PlanDistribution restaurants={restaurants} />
              <RevenueChart reports={reports} />
            </div>
          </section>
        )}

        {!isLoading && activeSection === "restaurants" && (
          <section className="super-admin-section">
            <SectionHeading eyebrow="Tenant yönetimi" title="Restoranlar" />
            <RestaurantForm
              city={restaurantCity}
              editingRestaurantId={editingRestaurantId}
              name={restaurantName}
              plan={selectedPlan}
              onCancel={resetRestaurantForm}
              onCityChange={setRestaurantCity}
              onNameChange={setRestaurantName}
              onPlanChange={setSelectedPlan}
              onSubmit={saveRestaurant}
            />
            <RestaurantTable
              query={query}
              restaurants={filteredRestaurants}
              onEdit={startEditingRestaurant}
              onPlanChange={updateRestaurantPlan}
              onQueryChange={setQuery}
              onToggle={toggleRestaurant}
            />
          </section>
        )}

        {!isLoading && activeSection === "subscriptions" && (
          <section className="super-admin-section">
            <SectionHeading eyebrow="Abonelik sistemi" title="Abonelikler" />
            <div className="super-admin-metrics">
              {(["Basic", "Pro", "Premium"] as SubscriptionPlan[]).map((plan) => (
                <MetricCard
                  key={plan}
                  label={`${plan} plan`}
                  value={formatCurrency(planPrices[plan])}
                />
              ))}
              <MetricCard label="Tahmini MRR" value={formatCurrency(mrr)} />
            </div>
            <SubscriptionsPanel
              restaurants={restaurants}
              onPlanChange={updateRestaurantPlan}
            />
          </section>
        )}

        {!isLoading && activeSection === "users" && (
          <section className="super-admin-section">
            <SectionHeading eyebrow="Yetkilendirme" title="Kullanıcılar" />
            <UsersPanel users={users} />
          </section>
        )}

        {!isLoading && activeSection === "reports" && (
          <section className="super-admin-section">
            <SectionHeading eyebrow="Sistem analizi" title="Sistem Raporları" />
            <div className="super-admin-overview-grid">
              <RevenueChart reports={reports} />
              <OrdersAnalysis reports={reports} />
            </div>
          </section>
        )}

        {!isLoading && activeSection === "settings" && (
          <section className="super-admin-section">
            <SectionHeading eyebrow="Platform" title="Ayarlar" />
            <section className="super-admin-panel settings-panel">
              <span>SA</span>
              <h3>Sistem ayarları</h3>
              <p>
                Faturalama, global limitler, destek erişimi ve sistem
                entegrasyonları için hazır yönetim alanı.
              </p>
            </section>
          </section>
        )}
      </section>
    </main>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="super-admin-section-heading">
      <div>
        <p>{eyebrow}</p>
        <h2>{title}</h2>
      </div>
    </div>
  );
}

function PanelHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="super-admin-panel-heading">
      <div>
        <p>{eyebrow}</p>
        <h3>{title}</h3>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number | string }) {
  return (
    <article>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function RestaurantForm({
  city,
  editingRestaurantId,
  name,
  plan,
  onCancel,
  onCityChange,
  onNameChange,
  onPlanChange,
  onSubmit,
}: {
  city: string;
  editingRestaurantId: number | null;
  name: string;
  plan: SubscriptionPlan;
  onCancel: () => void;
  onCityChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onPlanChange: (value: SubscriptionPlan) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="super-admin-panel">
      <PanelHeading
        eyebrow={editingRestaurantId ? "Düzenle" : "Yeni restoran"}
        title={editingRestaurantId ? "Restoran düzenle" : "Restoran ekle"}
      />
      <form className="super-admin-form" onSubmit={onSubmit}>
        <label>
          <span>Restoran adı</span>
          <input
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="Restoran adı"
            required
          />
        </label>
        <label>
          <span>Şehir</span>
          <input
            value={city}
            onChange={(event) => onCityChange(event.target.value)}
            placeholder="Istanbul"
            required
          />
        </label>
        <label>
          <span>Plan</span>
          <select
            value={plan}
            onChange={(event) =>
              onPlanChange(event.target.value as SubscriptionPlan)
            }
          >
            <option value="Basic">Basic</option>
            <option value="Pro">Pro</option>
            <option value="Premium">Premium</option>
          </select>
        </label>
        <div className="super-admin-form-actions">
          {editingRestaurantId && (
            <button type="button" onClick={onCancel}>
              Vazgeç
            </button>
          )}
          <button type="submit">
            {editingRestaurantId ? "Güncelle" : "Restoran Ekle"}
          </button>
        </div>
      </form>
    </section>
  );
}

function RestaurantTable({
  query,
  restaurants,
  onEdit,
  onPlanChange,
  onQueryChange,
  onToggle,
}: {
  query: string;
  restaurants: RestaurantAccount[];
  onEdit: (restaurant: RestaurantAccount) => void;
  onPlanChange: (restaurant: RestaurantAccount, plan: SubscriptionPlan) => void;
  onQueryChange: (value: string) => void;
  onToggle: (restaurant: RestaurantAccount) => void;
}) {
  return (
    <section className="super-admin-panel restaurant-table-panel">
      <div className="super-admin-panel-heading with-search">
        <div>
          <p>Liste</p>
          <h3>Restoranlar</h3>
        </div>
        <label className="restaurant-search">
          <span>Arama</span>
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="İsim, şehir, durum"
          />
        </label>
      </div>

      {restaurants.length === 0 ? (
        <EmptyState text="Restoran bulunamadı." />
      ) : (
        <div className="restaurant-table">
          <div className="restaurant-table-head">
            <span>Restoran</span>
            <span>Şehir</span>
            <span>Durum</span>
            <span>Plan</span>
            <span>Bitiş</span>
            <span>Gelir</span>
            <span>Aksiyon</span>
          </div>
          {restaurants.map((restaurant) => (
            <article className="restaurant-row" key={restaurant.id}>
              <div>
                <h3>{restaurant.name}</h3>
                <p>{restaurant.slug}</p>
              </div>
              <span>{restaurant.city}</span>
              <em className={`status-${restaurant.status.toLowerCase()}`}>
                {restaurant.status}
              </em>
              <select
                value={restaurant.plan}
                onChange={(event) =>
                  onPlanChange(restaurant, event.target.value as SubscriptionPlan)
                }
              >
                <option value="Basic">Basic</option>
                <option value="Pro">Pro</option>
                <option value="Premium">Premium</option>
              </select>
              <time>{formatDate(restaurant.subscriptionEndsAt)}</time>
              <b>{formatCurrency(restaurant.revenue)}</b>
              <div className="row-actions">
                <button type="button" onClick={() => onEdit(restaurant)}>
                  Düzenle
                </button>
                <button type="button" onClick={() => onToggle(restaurant)}>
                  {restaurant.status === "Active" ? "Pasif" : "Aktif"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function SubscriptionsPanel({
  restaurants,
  onPlanChange,
}: {
  restaurants: RestaurantAccount[];
  onPlanChange: (restaurant: RestaurantAccount, plan: SubscriptionPlan) => void;
}) {
  return (
    <section className="super-admin-panel">
      <PanelHeading eyebrow="Plan yönetimi" title="Restoran abonelikleri" />
      {restaurants.length === 0 ? (
        <EmptyState text="Abonelik kaydı yok." />
      ) : (
        <div className="subscription-grid">
          {restaurants.map((restaurant) => (
            <article key={restaurant.id}>
              <div>
                <h4>{restaurant.name}</h4>
                <p>Bitiş tarihi: {formatDate(restaurant.subscriptionEndsAt)}</p>
              </div>
              <select
                value={restaurant.plan}
                onChange={(event) =>
                  onPlanChange(restaurant, event.target.value as SubscriptionPlan)
                }
              >
                <option value="Basic">Basic</option>
                <option value="Pro">Pro</option>
                <option value="Premium">Premium</option>
              </select>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function UsersPanel({ users }: { users: SuperAdminUser[] }) {
  return (
    <section className="super-admin-panel">
      <PanelHeading eyebrow="Restoran adminleri" title="Kullanıcı Yönetimi" />
      {users.length === 0 ? (
        <EmptyState text="Kullanıcı yok." />
      ) : (
        <div className="users-grid">
          {users.map((user) => (
            <article key={user.id}>
              <div>
                <h4>{user.name}</h4>
                <p>{user.email}</p>
              </div>
              <span>{user.restaurantName}</span>
              <strong>{user.role}</strong>
              <em>{user.status}</em>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function PlanDistribution({
  restaurants,
}: {
  restaurants: RestaurantAccount[];
}) {
  return (
    <section className="super-admin-panel">
      <PanelHeading eyebrow="Abonelik dağılımı" title="Planlar" />
      <div className="plan-bars">
        {(["Basic", "Pro", "Premium"] as SubscriptionPlan[]).map((plan) => {
          const count = restaurants.filter(
            (restaurant) => restaurant.plan === plan,
          ).length;
          const width = `${Math.max(8, (count / Math.max(restaurants.length, 1)) * 100)}%`;

          return (
            <div className="plan-bar-row" key={plan}>
              <span>{plan}</span>
              <div>
                <b style={{ width }} />
              </div>
              <strong>{count}</strong>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RevenueChart({ reports }: { reports: PlatformReport[] }) {
  const maxRevenue = Math.max(...reports.map((report) => report.revenue), 1);

  return (
    <section className="super-admin-panel">
      <PanelHeading eyebrow="Gelir grafikleri" title="Aylık gelir" />
      {reports.length === 0 ? (
        <EmptyState text="Rapor verisi yok." />
      ) : (
        <div className="revenue-chart">
          {reports.map((report) => (
            <div key={report.label}>
              <span>{report.label}</span>
              <strong style={{ height: `${(report.revenue / maxRevenue) * 100}%` }} />
              <em>{formatCurrency(report.revenue)}</em>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function OrdersAnalysis({ reports }: { reports: PlatformReport[] }) {
  return (
    <section className="super-admin-panel">
      <PanelHeading eyebrow="Sipariş analizi" title="Sistem genelinde siparişler" />
      {reports.length === 0 ? (
        <EmptyState text="Sipariş analizi yok." />
      ) : (
        <div className="orders-analysis">
          {reports.map((report) => (
            <article key={report.label}>
              <span>{report.label}</span>
              <strong>{report.orders.toLocaleString("tr-TR")} sipariş</strong>
              <b>{formatCurrency(report.revenue)}</b>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="super-admin-empty">{text}</p>;
}

export default SuperAdminPage;
