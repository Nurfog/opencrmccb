"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Menu,
  Plus,
  Settings,
  HelpCircle,
  LogOut,
  Users,
  Building2,
  TrendingUp,
} from "lucide-react";
import { useI18n } from "@/contexts/i18n-context";
import { useAuthStore } from "@/stores/auth-store";
import { getInitials } from "@/lib/utils";
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
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onMenuClick}
          className="flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors lg:hidden"
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link href="/dashboard" className="hidden md:block text-[14.5px] font-semibold tracking-tight text-foreground lg:hidden">
          OpenCRM
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 max-w-lg mx-auto">
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
            className="flex items-center gap-1.5 rounded-[10px] bg-primary px-3 h-9 text-[13px] font-medium text-primary-foreground shadow-sm hover:brightness-95 transition-all ml-1"
          >
            <Plus className="h-4 w-4" strokeWidth={2.25} />
            <span className="hidden sm:inline">{t("common.new")}</span>
          </button>
          {showNewMenu && (
            <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-border bg-popover py-1.5 shadow-pop z-50 animate-fade-in">
              {newItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setShowNewMenu(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-[13.5px] text-popover-foreground hover:bg-muted transition-colors mx-1 rounded-lg"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <Link
          href="/settings"
          className="hidden sm:flex items-center justify-center rounded-lg h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Settings"
        >
          <Settings className="h-[18px] w-[18px]" />
        </Link>

        <Link
          href="/help"
          className="hidden sm:flex items-center justify-center rounded-lg h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Help"
        >
          <HelpCircle className="h-[18px] w-[18px]" />
        </Link>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary ring-1 ring-border hover:bg-primary/15 transition-colors ml-1"
            aria-label="User menu"
          >
            {user ? getInitials(`${user.first_name} ${user.last_name}`) : "U"}
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-border bg-popover py-1.5 shadow-pop z-50 animate-fade-in">
              <div className="border-b border-border px-3.5 py-2.5 mb-1">
                <p className="text-[13.5px] font-medium text-popover-foreground truncate leading-tight">
                  {user ? `${user.first_name} ${user.last_name}` : "User"}
                </p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {user?.email ?? ""}
                </p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2.5 px-3 py-2 mx-1 text-[13.5px] text-popover-foreground hover:bg-muted transition-colors rounded-lg"
                style={{ width: "calc(100% - 8px)" }}
              >
                <LogOut className="h-4 w-4 text-muted-foreground" />
                {t("auth.logout") ?? "Log out"}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
