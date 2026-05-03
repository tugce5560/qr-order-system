import { Link } from "react-router-dom";
import "./PanelNavigation.css";

function NotFound() {
  return (
    <main className="app-state-page">
      <section className="app-state-panel">
        <span className="app-state-kicker">404</span>
        <h1>Sayfa bulunamadı</h1>
        <p>Bu route tanımlı değil. Admin paneline dönebilirsiniz.</p>
        <Link to="/admin">Admin</Link>
      </section>
    </main>
  );
}

export default NotFound;
