"use client";

import { useEffect, useState, type ReactNode } from "react";
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
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const [mounted, setMounted] = useState(false);

  const permissionsLoaded = user && user.permissions?.length > 0;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !isAuthenticated) {
      router.replace("/login");
    }
  }, [mounted, isAuthenticated, router]);

  useEffect(() => {
    if (mounted && isAuthenticated && requiredPermission && permissionsLoaded && !hasPermission(requiredPermission)) {
      router.replace("/");
    }
  }, [mounted, isAuthenticated, requiredPermission, permissionsLoaded, hasPermission, router]);

  if (!mounted || !isAuthenticated) return null;
  if (requiredPermission && permissionsLoaded && !hasPermission(requiredPermission)) return null;

  return <>{children}</>;
}
