"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { Skeleton } from "@/components/ui/skeleton";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredPermission?: string;
}

export function ProtectedRoute({ children, requiredPermission }: ProtectedRouteProps) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isLoadingUser = useAuthStore((s) => s.isLoadingUser);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const loadUser = useAuthStore((s) => s.loadUser);
  const [mounted, setMounted] = useState(false);

  // `permissions` may legitimately be [] — loaded means user object exists.
  const permissionsLoaded = !!user && Array.isArray(user.permissions);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  const showSkeleton = !mounted || !isInitialized || isLoading || isLoadingUser;

  if (showSkeleton) {
    return (
      <div className="flex min-h-screen flex-col gap-4 p-6" aria-busy="true" aria-label="Loading">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col gap-4 p-6" aria-busy="true" aria-label="Redirecting to login">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (requiredPermission && permissionsLoaded && !hasPermission(requiredPermission)) {
    return (
      <div className="flex min-h-screen flex-col gap-4 p-6" aria-busy="true" aria-label="Checking permissions">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return <>{children}</>;
}
