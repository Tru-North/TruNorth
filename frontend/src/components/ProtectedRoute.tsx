import React from "react";
import { Navigate } from "react-router-dom";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const token = localStorage.getItem("token"); // Check if user has logged in

  if (!token) {
    // 🚫 No token found → user not logged in → send them to /auth
    return <Navigate to="/auth" replace />;
  }

  // ✅ Token found → show the requested page
  return <>{children}</>;
};

export default ProtectedRoute;
