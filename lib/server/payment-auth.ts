import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import type { UserRole } from "@/lib/types";

export interface PaymentActor {
  id: string;
  userId: string;
  restaurantId: string;
  roles: UserRole[];
}

export function paymentAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret) throw new Error("Supabase nao configurado no servidor.");
  return createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function authenticatePaymentActor(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { error: jsonError("Sessao nao encontrada.", 401) } as const;
  const admin = paymentAdminClient();
  const user = await admin.auth.getUser(token);
  if (user.error || !user.data.user) return { error: jsonError("Sessao invalida.", 401) } as const;
  const profile = await admin.from("profiles").select("id,user_id,restaurant_id,role,roles,active,deleted_at")
    .eq("user_id", user.data.user.id).eq("active", true).is("deleted_at", null).single();
  if (profile.error || !profile.data) return { error: jsonError("Perfil ativo nao encontrado.", 403) } as const;
  const roles = effectiveRoles(profile.data.role as UserRole, profile.data.roles as UserRole[] | null);
  return { admin, actor: { id: String(profile.data.id), userId: String(profile.data.user_id), restaurantId: String(profile.data.restaurant_id), roles } satisfies PaymentActor } as const;
}

export function canOperatePayments(actor: PaymentActor) {
  return actor.roles.some((role) => ["owner", "manager", "cashier", "waiter"].includes(role));
}

export function canEmergencyConfirmPix(actor: PaymentActor) {
  return actor.roles.some((role) => ["owner", "manager", "cashier"].includes(role));
}

export function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function effectiveRoles(role: UserRole, roles?: UserRole[] | null) {
  if (role === "owner" || roles?.includes("owner")) return ["owner"] as UserRole[];
  return roles?.length ? roles : [role];
}
