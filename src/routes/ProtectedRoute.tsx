/**
 * ProtectedRoute — Redirects to /login if not authenticated.
 * Optionally restricts by role.
 */

import { Navigate, Outlet } from "react-router-dom";
import { useAppSelector } from "../store/hooks";
import { selectIsAuthenticated, selectUserRole } from "../store/authSlice";
import type { User } from "../store/authSlice";

interface ProtectedRouteProps {
  allowedRoles?: User["role"][];
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const isAuth = useAppSelector(selectIsAuthenticated);
  const role = useAppSelector(selectUserRole);

  if (!isAuth) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
