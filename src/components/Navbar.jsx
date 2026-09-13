import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <nav className="navbar">
      <div className="navbar-brand">Ivy Homes</div>
      <div className="navbar-links">
        <NavLink to="/listings">Listings</NavLink>
        <NavLink to="/rentals">Rentals</NavLink>
        <NavLink to="/projects">Projects</NavLink>
        <NavLink to="/saved">Saved</NavLink>
        <NavLink to="/insights">Insights</NavLink>
      </div>
      <div className="navbar-user">
        <span>{user?.email}</span>
        <button onClick={handleLogout}>Log out</button>
      </div>
    </nav>
  );
}
