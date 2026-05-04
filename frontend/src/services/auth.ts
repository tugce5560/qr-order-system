export type UserRole =
  | "SuperAdmin"
  | "RestaurantAdmin"
  | "Kitchen"
  | "Waiter"
  | "Customer";

export type AuthUser = {
  userId: string;
  email: string;
  role: UserRole;
  restaurantId?: string;
  fullName?: string;
};

const tokenStorageKey = "authToken";
const legacyTokenStorageKey = "adminToken";
const bypassUser: AuthUser = {
  userId: "frontend-auth-disabled",
  email: "superadmin@test.com",
  role: "SuperAdmin",
  restaurantId: "1",
  fullName: "Demo Super Admin",
};

type JwtPayload = {
  userId?: string;
  sub?: string;
  email?: string;
  role?: string | string[];
  restaurantId?: string;
  exp?: number;
  name?: string;
  unique_name?: string;
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"?: string;
  "http://schemas.microsoft.com/ws/2008/06/identity/claims/role"?:
    | string
    | string[];
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"?: string;
};

export function getAuthToken() {
  return (
    localStorage.getItem(tokenStorageKey) ||
    localStorage.getItem(legacyTokenStorageKey)
  );
}

export function setAuthToken(token: string, restaurantId?: number | string | null) {
  localStorage.setItem(tokenStorageKey, token);
  localStorage.setItem(legacyTokenStorageKey, token);

  if (restaurantId !== undefined && restaurantId !== null) {
    localStorage.setItem("adminRestaurantId", String(restaurantId));
  } else {
    localStorage.removeItem("adminRestaurantId");
  }
}

export function clearAuth() {
  localStorage.removeItem(tokenStorageKey);
  localStorage.removeItem(legacyTokenStorageKey);
  localStorage.removeItem("adminRestaurantId");
}

export function decodeAuthToken(token: string): AuthUser | null {
  try {
    const payload = token
      .split(".")[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const parsedPayload = JSON.parse(
      atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, "=")),
    ) as JwtPayload;
    const rawRole =
      parsedPayload.role ??
      parsedPayload[
        "http://schemas.microsoft.com/ws/2008/06/identity/claims/role"
      ];
    const role = Array.isArray(rawRole) ? rawRole[0] : rawRole;

    if (!role || !isUserRole(role)) {
      return null;
    }

    if (parsedPayload.exp && parsedPayload.exp * 1000 <= Date.now()) {
      clearAuth();
      return null;
    }

    return {
      userId: parsedPayload.userId ?? parsedPayload.sub ?? "",
      email:
        parsedPayload.email ??
        parsedPayload[
          "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"
        ] ??
        "",
      role,
      restaurantId: parsedPayload.restaurantId,
      fullName:
        parsedPayload.name ??
        parsedPayload.unique_name ??
        parsedPayload[
          "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"
        ],
    };
  } catch {
    return null;
  }
}

export function getCurrentUser() {
  const token = getAuthToken();

  if (token) {
    const tokenUser = decodeAuthToken(token);

    if (tokenUser) {
      return tokenUser;
    }
  }

  return bypassUser;
}

export function getDefaultRouteForRole(role: UserRole) {
  switch (role) {
    case "SuperAdmin":
      return "/super-admin";
    case "RestaurantAdmin":
      return "/admin";
    case "Kitchen":
      return "/kitchen";
    case "Waiter":
      return "/waiter";
    case "Customer":
      return "/menu";
  }
}

function isUserRole(role: string): role is UserRole {
  return ["SuperAdmin", "RestaurantAdmin", "Kitchen", "Waiter", "Customer"].includes(
    role,
  );
}
