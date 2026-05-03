import { Link } from "react-router-dom";
import { getDefaultRouteForRole, type UserRole } from "../services/auth";
import "./PanelNavigation.css";

type AccessDeniedProps = {
  role?: UserRole;
};

function AccessDenied({ role }: AccessDeniedProps) {
  const returnPath = role ? getDefaultRouteForRole(role) : "/login";

  return (
    <main className="app-state-page">
      <section className="app-state-panel">
        <span className="app-state-kicker">403</span>
        <h1>Access Denied</h1>
        <p>Bu panele erişim yetkiniz yok.</p>
        <Link to={returnPath}>{role ? "Kendi paneline dön" : "Login"}</Link>
      </section>
    </main>
  );
}

export default AccessDenied;
