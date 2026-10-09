"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredPermission?: string;
}

export function ProtectedRoute({ children, requiredPermission }: ProtectedRouteProps) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const loadUser = useAuthStore((s) => s.loadUser);
  // Mounted flag without setState-in-effect: true on client, false on server.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const permissionsLoaded = !!user && !!user.permissions?.length;

  // Wait for the initial session check (AuthProvider.initialize -> loadUser)
  // before deciding: otherwise a valid cookie session flashes to /login.
  useEffect(() => {
    if (mounted && !isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [mounted, isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (mounted && !isLoading && isAuthenticated && requiredPermission && !permissionsLoaded) {
      loadUser();
    }
  }, [mounted, isLoading, isAuthenticated, requiredPermission, permissionsLoaded, loadUser]);

  useEffect(() => {
    if (mounted && !isLoading && isAuthenticated && requiredPermission && permissionsLoaded && !hasPermission(requiredPermission)) {
      router.replace("/");
    }
  }, [mounted, isLoading, isAuthenticated, requiredPermission, permissionsLoaded, hasPermission, router]);

  if (!mounted || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) return null;
  if (requiredPermission && permissionsLoaded && !hasPermission(requiredPermission)) return null;

  return <>{children}</>;
}
