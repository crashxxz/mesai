"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export function MobileBottomNav({ items, extraItems = [] }: { items: NavItem[]; extraItems?: NavItem[] }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const hasMore = items.length > 5 || extraItems.length > 0;
  const visibleItems = hasMore ? items.slice(0, 4) : items.slice(0, 5);
  const seen = new Set(visibleItems.map((item) => item.href));
  const moreItems = [...items.slice(4), ...extraItems].filter((item) => {
    if (seen.has(item.href)) return false;
    seen.add(item.href);
    return true;
  });
  const moreActive = moreItems.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));

  return (
    <>
      {moreOpen && moreItems.length ? (
        <div className="fixed inset-x-2 bottom-[5rem] z-40 rounded-lg border border-slate-200 bg-white p-2 shadow-soft md:hidden">
          <div className="grid gap-1">
            {moreItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm font-black text-slate-600",
                    active && "bg-amber-100 text-amber-800"
                  )}
                  title={item.label}
                  onClick={() => setMoreOpen(false)}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),0.35rem)] pt-2 backdrop-blur md:hidden">
        <div className="grid grid-cols-5 gap-1">
          {visibleItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-black text-slate-500",
                  active && "bg-amber-100 text-amber-800"
                )}
                title={item.label}
                onClick={() => setMoreOpen(false)}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            );
          })}
          {hasMore ? (
            <button
              type="button"
              className={cn(
                "flex h-14 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-black text-slate-500",
                (moreOpen || moreActive) && "bg-amber-100 text-amber-800"
              )}
              title="Mais"
              onClick={() => setMoreOpen((current) => !current)}
            >
              <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
              <span className="max-w-full truncate">Mais</span>
            </button>
          ) : null}
        </div>
      </nav>
    </>
  );
}
