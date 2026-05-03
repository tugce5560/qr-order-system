import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import AccessDenied from "./AccessDenied";
import {
  getCurrentUser,
  type UserRole,
} from "../services/auth";
import {
  ensureDemoAuthForPath,
  getDemoLoginTarget,
  isDemoAuthBypassEnabled,
} from "../services/demoAuth";

type ProtectedRouteProps = {
  allowedRoles: UserRole[];
  children: ReactNode;
};

function ProtectedRoute({ allowedRoles, children }: ProtectedRouteProps) {
  const location = useLocation();
  const [demoAuthAttempt, setDemoAuthAttempt] = useState<{
    pathname: string;
    status: "done" | "failed";
  } | null>(null);
  const user = getCurrentUser();
  const demoBypassEnabled = isDemoAuthBypassEnabled();
  const demoLoginTarget = getDemoLoginTarget(location.pathname);
  const shouldAttemptDemoLogin =
    demoBypassEnabled &&
    demoLoginTarget !== null &&
    (!user || !allowedRoles.includes(user.role));

  useEffect(() => {
    let isMounted = true;

    if (!shouldAttemptDemoLogin) {
      return undefined;
    }

    ensureDemoAuthForPath(location.pathname).then((demoUser) => {
      if (!isMounted) {
        return;
      }

      setDemoAuthAttempt({
        pathname: location.pathname,
        status: demoUser ? "done" : "failed",
      });
    });

    return () => {
      isMounted = false;
    };
  }, [location.pathname, shouldAttemptDemoLogin]);

  const demoAuthFailed =
    demoAuthAttempt?.pathname === location.pathname &&
    demoAuthAttempt.status === "failed";

  if (shouldAttemptDemoLogin && !demoAuthFailed) {
    return (
      <main className="app-state-page">
        <section className="app-state-panel">
          <span className="app-state-kicker">Demo Mod</span>
          <h1>Panel hazırlanıyor</h1>
          <p>Local demo kullanıcısı ile otomatik giriş yapılıyor.</p>
        </section>
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <AccessDenied role={user.role} />;
  }

  return children;
}

export default ProtectedRoute;
