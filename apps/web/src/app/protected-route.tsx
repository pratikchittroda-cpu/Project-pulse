import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "./auth-context.js";
import { LoadingState } from "./loading-state.js";

export function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return <LoadingState />;
  }

  if (status === "signed_out") {
    return (
      <Navigate to="/auth/login" replace state={{ from: location.pathname }} />
    );
  }

  return <Outlet />;
}
