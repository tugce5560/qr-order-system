import { api } from "./api";
import {
  getAuthToken,
  getCurrentUser,
  setAuthToken,
  type UserRole,
} from "./auth";

type LoginResponse = {
  token: string;
  restaurantId?: number | null;
};

type DemoLoginTarget = {
  role: UserRole;
  emails: string[];
};

const demoPassword = "admin123";

const demoLoginTargets: Record<string, DemoLoginTarget> = {
  "/admin": {
    role: "RestaurantAdmin",
    emails: ["admin@qrorder.local", "demo.admin@qrorder.local", "admin@test.com"],
  },
  "/admin/analytics": {
    role: "RestaurantAdmin",
    emails: ["admin@qrorder.local", "demo.admin@qrorder.local", "admin@test.com"],
  },
  "/waiter": {
    role: "Waiter",
    emails: ["waiter@qrorder.local", "demo.waiter@qrorder.local", "waiter@test.com"],
  },
  "/kitchen": {
    role: "Kitchen",
    emails: ["kitchen@qrorder.local", "demo.kitchen@qrorder.local", "kitchen@test.com"],
  },
  "/super-admin": {
    role: "SuperAdmin",
    emails: ["superadmin@qrorder.local", "superadmin@test.com"],
  },
};

export function isDemoAuthBypassEnabled() {
  return (
    import.meta.env.DEV &&
    import.meta.env.VITE_DEMO_AUTH_BYPASS === "true"
  );
}

export function getDemoLoginTarget(pathname: string) {
  return demoLoginTargets[pathname] ?? null;
}

export async function ensureDemoAuthForPath(pathname: string) {
  const target = getDemoLoginTarget(pathname);

  if (!target) {
    return getCurrentUser();
  }

  const currentUser = getCurrentUser();

  if (getAuthToken() && currentUser?.role === target.role) {
    return currentUser;
  }

  for (const email of target.emails) {
    try {
      const response = await api.post<LoginResponse>("/auth/login", {
        email,
        password: demoPassword,
      });

      setAuthToken(response.data.token, response.data.restaurantId);

      const user = getCurrentUser();

      if (user?.role === target.role) {
        return user;
      }
    } catch {
      // Try the next development demo account variant.
    }
  }

  return null;
}
