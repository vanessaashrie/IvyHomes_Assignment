import { createContext, useContext, useState, useCallback, useEffect } from "react";
import * as api from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const { userEmail } = api.getStoredAuth();
    return userEmail ? { email: userEmail } : null;
  });

  // If a request's refresh attempt fails (refresh token itself expired/invalid),
  // the API client calls this to force us back to a logged-out state so
  // ProtectedRoute redirects to /login instead of leaving a broken session.
  useEffect(() => {
    api.setAuthFailureHandler(() => setUser(null));
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api.login(email, password);
    setUser({ email: data.user?.email || email });
    return data;
  }, []);

  const logout = useCallback(() => {
    api.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoggedIn: Boolean(user) }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}