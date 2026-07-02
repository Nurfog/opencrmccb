"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  TrendingUp,
  Target,
  Calendar,
  Mail,
  BarChart3,
  FileText,
  MessageCircle,
  Settings,
  HelpCircle,
  ScrollText,
  Shield,
  X,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { cn, getInitials } from "@/lib/utils";
import { useI18n } from "@/contexts/i18n-context";

interface SidebarProps {
  onClose?: () => void;
}

interface NavItem {
  labelKey: string;
  href: string;
  icon: React.ElementType;
}

const mainNav: NavItem[] = [
  { labelKey: "nav.dashboard", href: "/dashboard", icon: LayoutDashboard },
  { labelKey: "nav.contacts", href: "/contacts", icon: Users },
  { labelKey: "nav.companies", href: "/companies", icon: Building2 },
  { labelKey: "nav.deals", href: "/deals", icon: TrendingUp },
  { labelKey: "nav.leads", href: "/leads", icon: Target },
  { labelKey: "nav.email", href: "/email", icon: Mail },
  { labelKey: "nav.calendar", href: "/calendar", icon: Calendar },
  { labelKey: "nav.activities", href: "/activities", icon: Calendar },
  { labelKey: "nav.reports", href: "/reports", icon: BarChart3 },
  { labelKey: "nav.documents", href: "/documents", icon: FileText },
  { labelKey: "nav.whatsapp", href: "/whatsapp", icon: MessageCircle },
];

const bottomNav: NavItem[] = [
  { labelKey: "nav.settings", href: "/settings", icon: Settings },
  { labelKey: "nav.admin", href: "/admin", icon: Shield },
  { labelKey: "nav.help", href: "/help", icon: HelpCircle },
  { labelKey: "nav.audit", href: "/audit", icon: ScrollText },
];

export function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const { t } = useI18n();

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === href;
    return pathname.startsWith(href);
  }

  // Filter nav items based on permissions
  // If user has no permissions (not loaded / no migration yet), show all items
  const hasPermissionsLoaded = user && user.permissions?.length > 0;

  const filteredMainNav = mainNav.filter((item) => {
    if (item.href === "/dashboard") return true;
    if (!hasPermissionsLoaded) return true;
    const permissionMap: Record<string, string> = {
      "/contacts": "contacts.view",
      "/companies": "companies.view",
      "/deals": "deals.view",
      "/leads": "contacts.view",
      "/email": "contacts.view",
      "/calendar": "contacts.view",
      "/activities": "activities.view",
      "/reports": "reports.view",
      "/documents": "contacts.view",
      "/whatsapp": "contacts.view",
    };
    const requiredPermission = permissionMap[item.href];
    return !requiredPermission || hasPermission(requiredPermission);
  });

  const filteredBottomNav = bottomNav.filter((item) => {
    if (!hasPermissionsLoaded) return true;
    if (item.href === "/settings") return true;
    if (item.href === "/help") return true;
    if (item.href === "/admin") return hasPermission("admin.access");
    if (item.href === "/audit") return hasPermission("admin.access");
    return true;
  });

  return (
    <div className="slds-sidebar" role="complementary" aria-label="Main navigation">
      <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-white/20 text-lg font-bold text-white">
            O
          </div>
          <span className="text-lg font-bold text-white">OpenCRM</span>
        </Link>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-white/60 hover:text-white lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-2" aria-label="Main menu">
        {filteredMainNav.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "slds-sidebar__item",
                active && "slds-sidebar__item--active"
              )}
              onClick={onClose}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{t(item.labelKey)}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 py-2">
        {filteredBottomNav.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "slds-sidebar__item",
                active && "slds-sidebar__item--active"
              )}
              onClick={onClose}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{t(item.labelKey)}</span>
            </Link>
          );
        })}
      </div>

      <div className="border-t border-white/10 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-xs font-bold text-white">
            {user ? getInitials(`${user.first_name} ${user.last_name}`) : "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium text-white">
              {user ? `${user.first_name} ${user.last_name}` : "User"}
            </p>
            <p className="truncate text-xs text-white/60">{user?.email ?? ""}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
