import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../services/api";
import {
  getDefaultRouteForRole,
  getCurrentUser,
  setAuthToken,
  type UserRole,
} from "../../services/auth";

type LoginResponse = {
  token: string;
  expiresAt: string;
  userId: number;
  fullName: string;
  email: string;
  role: UserRole;
  restaurantId?: number | null;
};

const demoUsers = [
  "superadmin@qrorder.local",
  "demo.admin@qrorder.local",
  "demo.kitchen@qrorder.local",
  "demo.waiter@qrorder.local",
  "demo.customer@qrorder.local",
  "bistro.admin@qrorder.local",
  "bistro.kitchen@qrorder.local",
  "bistro.waiter@qrorder.local",
  "bistro.customer@qrorder.local",
  "admin@qrorder.local",
  "kitchen@qrorder.local",
  "waiter@qrorder.local",
  "customer@qrorder.local",
];

function AdminLoginPage() {
  const navigate = useNavigate();
  const showDemoUsers = import.meta.env.DEV;
  const [email, setEmail] = useState(showDemoUsers ? "demo.admin@qrorder.local" : "");
  const [password, setPassword] = useState(showDemoUsers ? "admin123" : "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const user = getCurrentUser();

    if (user) {
      navigate(getDefaultRouteForRole(user.role), { replace: true });
    }
  }, [navigate]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setIsSubmitting(true);
      setError(null);

      const response = await api.post<LoginResponse>("/auth/login", {
        email,
        password,
      });

      setAuthToken(response.data.token, response.data.restaurantId);
      navigate(getDefaultRouteForRole(response.data.role), { replace: true });
    } catch {
      setError("Giriş başarısız. E-posta veya şifreyi kontrol edin.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main style={{ maxWidth: 440, margin: "60px auto", padding: 20 }}>
      <h1>Login</h1>
      <p>Rolünüze göre doğru panele yönlendirilirsiniz.</p>

      {error && <p style={{ color: "#b42318" }}>{error}</p>}

      <form onSubmit={login} style={{ display: "grid", gap: 12 }}>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email"
          required
        />
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          required
        />
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Giriş yapılıyor..." : "Login"}
        </button>
      </form>

      {showDemoUsers && (
        <section style={{ marginTop: 18 }}>
          <strong>Demo kullanıcılar</strong>
          <ul>
            {demoUsers.map((demoUser) => (
              <li key={demoUser}>
                <button type="button" onClick={() => setEmail(demoUser)}>
                  {demoUser}
                </button>
              </li>
            ))}
          </ul>
          <p>Şifre: admin123</p>
        </section>
      )}
    </main>
  );
}

export default AdminLoginPage;
