"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChefHat,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Martini,
  Package,
  Settings,
  Table2,
  UsersRound,
  WalletCards
} from "lucide-react";
import { useEffect } from "react";
import { BrandLogo, BrandMark } from "@/components/brand-mark";
import { MobileBottomNav, type NavItem } from "@/components/mobile-bottom-nav";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { useBusinessPreset } from "@/lib/use-business-preset";
import type { UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";

type NavKey = "dashboard" | "tables" | "kitchen" | "bar" | "cash" | "products" | "finance" | "settings";

const navItems: Array<NavItem & { key: NavKey; roles: UserRole[]; section: "operation" | "admin" }> = [
  { key: "dashboard", href: "/app/dashboard", label: "Agora", icon: LayoutDashboard, roles: ["owner", "manager"], section: "operation" },
  { key: "tables", href: "/app/tables", label: "Mesas", icon: Table2, roles: ["owner", "manager", "waiter"], section: "operation" },
  { key: "kitchen", href: "/app/kitchen", label: "Cozinha", icon: ChefHat, roles: ["owner", "manager", "kitchen"], section: "operation" },
  { key: "bar", href: "/app/bar", label: "Bar", icon: Martini, roles: ["owner", "manager", "bar"], section: "operation" },
  { key: "cash", href: "/app/cash", label: "Caixa", icon: ClipboardList, roles: ["owner", "manager", "cashier"], section: "operation" },
  { key: "products", href: "/app/products", label: "Cardápio", icon: Package, roles: ["owner", "manager"], section: "admin" },
  { key: "finance", href: "/app/finance", label: "Financeiro", icon: WalletCards, roles: ["owner", "manager"], section: "admin" },
  { key: "settings", href: "/app/settings", label: "Ajustes", icon: Settings, roles: ["owner"], section: "admin" }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { hydrated, profile, restaurant, logout } = useStore();
  const { preset } = useBusinessPreset();

  useEffect(() => {
    if (hydrated && !profile) router.replace("/app/login");
  }, [hydrated, profile, router]);

  if (!hydrated || !profile) return null;

  const allowedItems = navItems
    .filter((item) => item.roles.includes(profile.role))
    .map((item) => ({ ...item, label: preset.menuLabels[item.key] }));
  const operationItems = allowedItems.filter((item) => item.section === "operation");
  const adminItems = allowedItems.filter((item) => item.section === "admin");
  const mobileExtraItems: NavItem[] =
    profile.role === "owner" ? [{ href: "/app/settings/users", label: "Equipe", icon: UsersRound }] : [];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-100 bg-white px-4 py-5 md:block">
        <Link href="/app/dashboard" className="flex items-center gap-3 rounded-xl px-2 py-1 transition hover:bg-slate-50">
          <BrandLogo markClassName="h-11 w-11" />
        </Link>

        <nav className="mt-7 grid gap-5">
          <NavGroup title="Operação" items={operationItems} pathname={pathname} />
          {adminItems.length ? <NavGroup title="Administração" items={adminItems} pathname={pathname} /> : null}
        </nav>

        <div className="mt-5 rounded-2xl bg-amber-50 p-3">
          <div className="text-xs font-black uppercase text-amber-800">Agora</div>
          <div className="mt-1 truncate text-sm font-bold text-amber-900">{restaurant?.name}</div>
        </div>

        {/* Footer */}
        <div className="absolute inset-x-4 bottom-5">
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-red-50 hover:text-red-700"
            onClick={() => {
              logout();
              router.replace("/app/login");
            }}
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sair
          </button>
        </div>
      </aside>

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/95 backdrop-blur md:ml-64">
        <div className="flex h-14 items-center justify-between px-4 md:px-6">
            <div className="flex min-w-0 items-center gap-3">
            <BrandMark className="h-9 w-9 md:hidden" />
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-slate-900">{restaurant?.name}</div>
              <div className="truncate text-xs font-medium text-slate-500">{profile.name}</div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            title="Sair"
            className="md:hidden"
            onClick={() => {
              logout();
              router.replace("/app/login");
            }}
          >
            <LogOut className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>
      </header>

      <main className="px-4 pb-24 pt-5 md:ml-64 md:px-6 md:pb-8">{children}</main>
      <MobileBottomNav items={allowedItems} extraItems={mobileExtraItems} />
    </div>
  );
}

function NavGroup({
  title,
  items,
  pathname
}: {
  title: string;
  items: Array<NavItem & { key: NavKey; roles: UserRole[]; section: "operation" | "admin" }>;
  pathname: string;
}) {
  return (
    <div className="grid gap-1">
      <div className="px-3 text-[10px] font-black uppercase tracking-wide text-slate-400">{title}</div>
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-slate-600 transition",
              active ? "bg-amber-50 font-bold text-amber-900" : "hover:bg-slate-50"
            )}
            title={item.label}
          >
            <Icon className={cn("h-5 w-5", active ? "text-amber-600" : "text-slate-400")} aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
