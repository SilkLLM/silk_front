/**
 * useAuth.ts
 * React hook providing authentication state and helpers.
 * Reads the JWT token from localStorage and fetches the user profile.
 */

// File: silkllm-frontend/src/hooks/useAuth.ts

import { useState, useEffect, createContext, useContext } from "react";
import { authApi } from "@/services/api";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  balance: number;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAdmin: false,
  logout: () => {},
  refreshUser: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function useAuthState(): AuthContextType {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    const token = localStorage.getItem("silk_token");
    if (!token) { setLoading(false); return; }
    try {
      const { data } = await authApi.me();
      setUser(data);
    } catch {
      localStorage.removeItem("silk_token");
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUser(); }, []);

  const logout = () => {
    localStorage.removeItem("silk_token");
    setUser(null);
    window.location.href = "/";
  };

  return {
    user,
    loading,
    isAdmin: user?.role === "admin" || user?.role === "super_admin",
    logout,
    refreshUser: fetchUser,
  };
}

// EOF silkllm-frontend/src/hooks/useAuth.ts
