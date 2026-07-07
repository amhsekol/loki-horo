import { createContext, useContext, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { PublicUser } from "@shared/schema";

interface AuthCtx {
  user: PublicUser | null;
  isLoading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, displayName: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // on401 default is "throw"; use a custom queryFn variant that returns null.
  const meQuery = useQuery<PublicUser | null>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/auth/me");
      return (await res.json()) as PublicUser | null;
    },
  });

  const user = meQuery.data ?? null;

  async function login(email: string, password: string) {
    const res = await apiRequest("POST", "/api/auth/login", { email, password });
    const u = (await res.json()) as PublicUser;
    queryClient.setQueryData(["/api/auth/me"], u);
    await queryClient.invalidateQueries({ queryKey: ["/api/charts"] });
  }

  async function register(email: string, displayName: string, password: string) {
    const res = await apiRequest("POST", "/api/auth/register", { email, displayName, password });
    const u = (await res.json()) as PublicUser;
    queryClient.setQueryData(["/api/auth/me"], u);
    await queryClient.invalidateQueries({ queryKey: ["/api/charts"] });
  }

  async function logout() {
    await apiRequest("POST", "/api/auth/logout");
    queryClient.setQueryData(["/api/auth/me"], null);
    // Clear any user-scoped data from the cache.
    queryClient.removeQueries({ queryKey: ["/api/charts"] });
    queryClient.removeQueries({ queryKey: ["/api/admin/users"] });
  }

  return (
    <Ctx.Provider
      value={{
        user,
        isLoading: meQuery.isLoading,
        isAdmin: user?.role === "admin",
        login,
        register,
        logout,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}
