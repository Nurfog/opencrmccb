"use client";

import { useState, useRef, useCallback, type ReactNode } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { useI18n } from "@/contexts/i18n-context";

export function AppLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const { t } = useI18n();

  const handleSkip = useCallback(() => {
    mainRef.current?.focus();
  }, []);

  return (
    <ProtectedRoute>
      <a
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          handleSkip();
        }}
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-blue-600 focus:px-4 focus:py-2 focus:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {t("nav.skipToContent") || "Skip to main content"}
      </a>
      <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div
          className={`fixed inset-y-0 left-0 z-40 -translate-x-full transition-transform duration-200 lg:static lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : ""
          }`}
        >
          <Sidebar onClose={() => setSidebarOpen(false)} />
        </div>

        {/* Main content area */}
        <div className="flex flex-1 flex-col min-w-0">
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <main
            ref={mainRef}
            id="main-content"
            tabIndex={-1}
            className="flex-1 overflow-y-auto p-6 outline-none"
          >
            {children}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
