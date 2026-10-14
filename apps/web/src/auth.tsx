import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router";
import * as api from "./api";
import type { Whoami } from "./types";

interface AuthState {
  /** undefined while checking, null when signed out. */
  me: Whoami | null | undefined;
  login: (name: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  me: undefined,
  login: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Whoami | null | undefined>(undefined);

  useEffect(() => {
    api
      .run("whoami")
      .then(setMe)
      .catch(() => setMe(null));
    return api.onUnauthorized(() => setMe(null));
  }, []);

  const login = useCallback(async (name: string, password: string) => {
    setMe(await api.login(name, password));
  }, []);
  const logout = useCallback(async () => {
    await api.logout().catch(() => {});
    setMe(null);
  }, []);

  const value = useMemo(() => ({ me, login, logout }), [me, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export function RequireAuth({ children }: { children: ReactNode }) {
  const { me } = useAuth();
  const location = useLocation();
  if (me === undefined) return <div className="h-dvh bg-canvas" />;
  if (me === null)
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <>{children}</>;
}
