import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { AuthMeDto } from "@/api/types";

interface AuthContextValue {
  me: AuthMeDto | undefined;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  refetch: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data: me, isLoading, refetch } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: api.getMe,
    retry: false,
  });

  const logout = useCallback(async () => {
    await api.logout();
    await queryClient.invalidateQueries({ queryKey: ["auth"] });
    window.location.href = "/login";
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      me,
      isLoading,
      isAuthenticated: Boolean(me?.authenticated),
      isAdmin: me?.account?.role === "admin",
      refetch: async () => {
        await refetch();
      },
      logout,
    }),
    [isLoading, logout, me, refetch],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
