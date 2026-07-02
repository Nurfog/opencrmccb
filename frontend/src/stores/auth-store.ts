import { create } from "zustand";
import type { User } from "@/lib/api";
import { authApi, setTokens, clearTokens, setLogoutHandler, getAccessToken } from "@/lib/api";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  updateUser: (user: Partial<User>) => void;
  clearError: () => void;
  initialize: () => void;
  hasPermission: (permission: string) => boolean;
}

function getStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem("user");
    if (!stored) return null;
    const user = JSON.parse(stored);
    // If stored user has no permissions (old format), discard it and refetch
    if (!user.permissions || !Array.isArray(user.permissions)) {
      localStorage.removeItem("user");
      return null;
    }
    return user;
  } catch {
    return null;
  }
}

function storeUser(user: User | null): void {
  if (typeof window !== "undefined") {
    if (user) {
      localStorage.setItem("user", JSON.stringify(user));
    } else {
      localStorage.removeItem("user");
    }
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: getStoredUser(),
  isAuthenticated: !!getAccessToken(),
  isLoading: false,
  error: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authApi.login({ email, password });
      setTokens(response.access_token, response.refresh_token);
      storeUser(response.user);
      set({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Login failed. Please try again.";
      set({ isLoading: false, error: message });
      throw err;
    }
  },

  register: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authApi.register(data);
      setTokens(response.access_token, response.refresh_token);
      storeUser(response.user);
      set({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Registration failed. Please try again.";
      set({ isLoading: false, error: message });
      throw err;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await authApi.logout();
    } catch {
      // proceed with local logout even if API call fails
    } finally {
      clearTokens();
      storeUser(null);
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  },

  loadUser: async () => {
    const token = getAccessToken();
    if (!token) {
      set({ user: null, isAuthenticated: false, isLoading: false });
      return;
    }
    set({ isLoading: true });
    try {
      const user = await authApi.me();
      storeUser(user);
      set({ user, isAuthenticated: true, isLoading: false, error: null });
    } catch {
      clearTokens();
      storeUser(null);
      set({ user: null, isAuthenticated: false, isLoading: false, error: null });
    }
  },

  updateUser: (partial: Partial<User>) => {
    const current = get().user;
    if (!current) return;
    const updated = { ...current, ...partial };
    storeUser(updated);
    set({ user: updated });
  },

  clearError: () => set({ error: null }),

  hasPermission: (permission: string) => {
    const user = get().user;
    if (!user) return false;
    return user.permissions?.includes(permission) ?? false;
  },

  initialize: () => {
    setLogoutHandler(() => {
      storeUser(null);
      set({ user: null, isAuthenticated: false });
    });

    const token = getAccessToken();
    if (token) {
      get().loadUser();
    }
  },
}));
