import { create } from "zustand";
import type { User } from "@/lib/api";
import { authApi, setTokens, clearTokens, setLogoutHandler } from "@/lib/api";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isLoadingLogin: boolean;
  isLoadingUser: boolean;
  isInitialized: boolean;
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
  initialize: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

// Tokens are managed via httpOnly cookies, not localStorage

let initializePromise: Promise<void> | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  isLoadingLogin: false,
  isLoadingUser: false,
  isInitialized: false,
  error: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true, isLoadingLogin: true, error: null });
    try {
      const response = await authApi.login({ email, password });
      setTokens(response.access_token, response.refresh_token);
      set({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
        isLoadingLogin: false,
        error: null,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Login failed. Please try again.";
      set({ isLoading: false, isLoadingLogin: false, error: message });
      throw err;
    }
  },

  register: async (data) => {
    set({ isLoading: true, isLoadingLogin: true, error: null });
    try {
      const response = await authApi.register(data);
      setTokens(response.access_token, response.refresh_token);
      set({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
        isLoadingLogin: false,
        error: null,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Registration failed. Please try again.";
      set({ isLoading: false, isLoadingLogin: false, error: message });
      throw err;
    }
  },

  logout: async () => {
    set({ isLoading: true, isLoadingLogin: true });
    try {
      await authApi.logout();
    } catch {
      // proceed with local logout even if API call fails
    } finally {
      clearTokens();
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        isLoadingLogin: false,
        error: null,
      });
      // Guaranteed redirect even if API/logout handler fails.
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
  },

  loadUser: async () => {
    set({ isLoading: true, isLoadingUser: true });
    try {
      const user = await authApi.me();
      set({
        user,
        isAuthenticated: true,
        isLoading: false,
        isLoadingUser: false,
        isInitialized: true,
        error: null,
      });
    } catch {
      clearTokens();
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        isLoadingUser: false,
        isInitialized: true,
        error: null,
      });
    }
  },

  updateUser: (partial: Partial<User>) => {
    const current = get().user;
    if (!current) return;
    const updated = { ...current, ...partial };
    set({ user: updated });
  },

  clearError: () => set({ error: null }),

  hasPermission: (permission: string) => {
    const user = get().user;
    if (!user) return false;
    return user.permissions?.includes(permission) ?? false;
  },

  initialize: async () => {
    if (get().isInitialized) return;
    if (initializePromise) return initializePromise;
    setLogoutHandler(() => {
      set({ user: null, isAuthenticated: false });
    });

    initializePromise = get()
      .loadUser()
      .finally(() => {
        set({ isInitialized: true });
        initializePromise = null;
      });
    return initializePromise;
  },
}));
