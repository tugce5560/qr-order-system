import { api } from "./api";
import {
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
    emails: ["demo.admin@qrorder.local", "admin@qrorder.local"],
  },
  "/admin/analytics": {
    role: "RestaurantAdmin",
    emails: ["demo.admin@qrorder.local", "admin@qrorder.local"],
  },
  "/waiter": {
    role: "Waiter",
    emails: ["demo.waiter@qrorder.local", "waiter@qrorder.local"],
  },
  "/kitchen": {
    role: "Kitchen",
    emails: ["demo.kitchen@qrorder.local", "kitchen@qrorder.local"],
  },
  "/super-admin": {
    role: "SuperAdmin",
    emails: ["superadmin@qrorder.local"],
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
  if (!isDemoAuthBypassEnabled()) {
    return getCurrentUser();
  }

  const target = getDemoLoginTarget(pathname);

  if (!target) {
    return getCurrentUser();
  }

  const currentUser = getCurrentUser();

  if (currentUser?.role === target.role) {
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
