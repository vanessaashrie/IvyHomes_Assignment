import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Navbar from "./Navbar";

export default function ProtectedRoute() {
  const { isLoggedIn } = useAuth();
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  return (
    <div className="app-shell">
      <Navbar />
      <main>
        <Outlet />
      </main>
    </div>
  );
}
