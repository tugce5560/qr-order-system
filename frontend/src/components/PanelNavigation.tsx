import { NavLink, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import {
  clearAuth,
  getCurrentUser,
  getDefaultRouteForRole,
  type UserRole,
} from "../services/auth";
import { isDemoAuthBypassEnabled } from "../services/demoAuth";
import NotificationCenter from "./NotificationCenter";
import "./PanelNavigation.css";

type PanelNavigationProps = {
  children: ReactNode;
};

type PanelLink = {
  label: string;
  path: string;
  roles: UserRole[];
};

const panelLinks: PanelLink[] = [
  {
    label: "Customer",
    path: "/menu",
    roles: ["Customer"],
  },
  {
    label: "Waiter",
    path: "/waiter",
    roles: ["Waiter", "RestaurantAdmin", "SuperAdmin"],
  },
  {
    label: "Kitchen",
    path: "/kitchen",
    roles: ["Kitchen", "RestaurantAdmin", "SuperAdmin"],
  },
  {
    label: "Admin",
    path: "/admin",
    roles: ["RestaurantAdmin"],
  },
  {
    label: "Super Admin",
    path: "/super-admin",
    roles: ["SuperAdmin"],
  },
];

function PanelNavigation({ children }: PanelNavigationProps) {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const demoBypassEnabled = isDemoAuthBypassEnabled();

  function logout() {
    clearAuth();
    navigate(demoBypassEnabled ? "." : "/login", { replace: true });
  }

  if (!user) {
    return <>{children}</>;
  }

  const homePath = getDefaultRouteForRole(user.role);
  const visibleLinks = panelLinks.filter((link) =>
    link.roles.includes(user.role),
  );

  return (
    <div className="panel-layout">
      <header className="panel-topbar">
        <div className="panel-brand">
          <span>
            QR Order
            {demoBypassEnabled && (
              <b className="panel-demo-badge">Demo Mod</b>
            )}
          </span>
          <strong>{user.fullName || user.email || user.role}</strong>
        </div>

        <nav className="panel-nav" aria-label="Panel navigation">
          <NavLink end to={homePath}>
            Dashboard
          </NavLink>
          {visibleLinks
            .filter((link) => link.path !== homePath)
            .map((link) => (
              <NavLink key={link.path} to={link.path}>
                {link.label}
              </NavLink>
            ))}
        </nav>

        <button className="panel-logout" type="button" onClick={logout}>
          Logout
        </button>
      </header>

      {children}
      <NotificationCenter />
    </div>
  );
}

export default PanelNavigation;
