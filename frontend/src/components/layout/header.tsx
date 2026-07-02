"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Menu,
  Search,
  Plus,
  Bell,
  Settings,
  HelpCircle,
  LogOut,
  Users,
  Building2,
  TrendingUp,
} from "lucide-react";
import { useI18n } from "@/contexts/i18n-context";
import { useAuthStore } from "@/stores/auth-store";
import { cn, getInitials } from "@/lib/utils";
import { LanguageSwitcher } from "./language-switcher";
import { ThemeToggle } from "../ui/theme-toggle";
import { GlobalSearch } from "../ui/global-search";
import { NotificationCenter } from "../ui/notification-center";

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { t } = useI18n();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const newMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
      if (newMenuRef.current && !newMenuRef.current.contains(e.target as Node)) {
        setShowNewMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("global-search")?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  async function handleLogout() {
    setShowUserMenu(false);
    await logout();
    router.push("/login");
  }

  const newItems = [
    { label: t("contacts.title"), href: "/contacts", icon: Users },
    { label: t("companies.title"), href: "/companies", icon: Building2 },
    { label: t("deals.title"), href: "/deals", icon: TrendingUp },
  ];

  return (
    <header className="slds-global-header" role="banner">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="flex items-center justify-center rounded p-1.5 text-white/80 hover:text-white transition-colors lg:hidden"
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link href="/dashboard" className="hidden sm:block text-lg font-bold text-white">
          OpenCRM
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 max-w-md mx-auto">
        <GlobalSearch className="w-full" />
      </div>

      <div className="flex items-center gap-1">
        <LanguageSwitcher />
        <NotificationCenter />

        <ThemeToggle />

        <div className="relative" ref={newMenuRef}>
          <button
            type="button"
            onClick={() => setShowNewMenu(!showNewMenu)}
            className="flex items-center gap-1 rounded bg-white/15 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/25 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t("common.new")}</span>
          </button>
          {showNewMenu && (
            <div className="absolute right-0 top-full mt-1 w-44 rounded-md border bg-white py-1 shadow-lg dark:bg-gray-900 dark:border-gray-700 z-50">
              {newItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setShowNewMenu(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <Link
          href="/activities"
          className="relative flex items-center justify-center rounded p-1.5 text-white/80 hover:text-white transition-colors"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
        </Link>

        <Link
          href="/settings"
          className="flex items-center justify-center rounded p-1.5 text-white/80 hover:text-white transition-colors"
          aria-label="Settings"
        >
          <Settings className="h-4 w-4" />
        </Link>

        <Link
          href="/help"
          className="hidden sm:flex items-center justify-center rounded p-1.5 text-white/80 hover:text-white transition-colors"
          aria-label="Help"
        >
          <HelpCircle className="h-4 w-4" />
        </Link>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center justify-center rounded-full bg-white/20 px-2 py-1 text-xs font-bold text-white hover:bg-white/30 transition-colors ml-1"
            aria-label="User menu"
          >
            {user ? getInitials(`${user.first_name} ${user.last_name}`) : "U"}
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-full mt-1 w-48 rounded-md border bg-white py-1 shadow-lg dark:bg-gray-900 dark:border-gray-700 z-50">
              <div className="border-b px-3 py-2 dark:border-gray-700">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {user ? `${user.first_name} ${user.last_name}` : "User"}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {user?.email ?? ""}
                </p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                {t("auth.logout") ?? "Log out"}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
