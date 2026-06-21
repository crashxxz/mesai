"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { canAccess } from "@/lib/permissions";
import type { UserRole } from "@/lib/types";

export function RoleGuard({
  allowed,
  children
}: {
  allowed: UserRole[];
  children: React.ReactNode;
}) {
  const { profile } = useStore();

  if (!canAccess(profile, allowed)) {
    return (
      <section className="mx-auto grid max-w-md gap-4 rounded-lg border border-slate-200 bg-white p-6 text-center shadow-soft">
        <ShieldAlert className="mx-auto h-9 w-9 text-amber-600" aria-hidden="true" />
        <h1 className="text-xl font-black text-slate-900">Acesso não permitido</h1>
        <p className="text-sm font-bold text-slate-500">Você não tem permissão para acessar esta área.</p>
        <Button asChild>
          <Link href="/app/tables">Ir para mesas</Link>
        </Button>
      </section>
    );
  }

  return children;
}
