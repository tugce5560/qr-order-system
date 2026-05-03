import type { ReactNode } from "react";
import type { UserRole } from "../services/auth";

type ProtectedRouteProps = {
  allowedRoles?: UserRole[];
  children: ReactNode;
};

function ProtectedRoute({ children }: ProtectedRouteProps) {
  return children;
}

export default ProtectedRoute;
