import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Listings from "./pages/Listings";
import ListingDetail from "./pages/ListingDetail";
import Rentals from "./pages/Rentals";
import Projects from "./pages/Projects";
import Saved from "./pages/Saved";
import Insights from "./pages/Insights";
import "./App.css";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/listings" element={<Listings />} />
            <Route path="/listings/:id" element={<ListingDetail />} />
            <Route path="/rentals" element={<Rentals />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/saved" element={<Saved />} />
            <Route path="/insights" element={<Insights />} />
          </Route>
          <Route path="*" element={<Navigate to="/listings" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
