import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { canAssignRole, canManageTeam, isUserRole } from "@/lib/team-policy";
import type { UserRole } from "@/lib/types";

export const runtime = "nodejs";

interface ActorProfile {
  id: string;
  user_id: string;
  restaurant_id: string;
  role: UserRole;
  active: boolean;
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret) throw new Error("Supabase não configurado no servidor.");
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

async function authenticate(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { error: response("Sessão não encontrada.", 401) } as const;

  const admin = adminClient();
  const userResult = await admin.auth.getUser(token);
  if (userResult.error || !userResult.data.user) {
    return { error: response("Sessão inválida.", 401) } as const;
  }

  const profileResult = await admin
    .from("profiles")
    .select("id,user_id,restaurant_id,role,active")
    .eq("user_id", userResult.data.user.id)
    .eq("active", true)
    .single();
  const actor = profileResult.data as ActorProfile | null;
  if (profileResult.error || !actor || !canManageTeam(actor.role)) {
    return { error: response("Sem permissão para gerenciar a equipe.", 403) } as const;
  }
  return { admin, actor, authUserId: userResult.data.user.id } as const;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticate(request);
    if ("error" in auth) return auth.error;
    const result = await auth.admin
      .from("profiles")
      .select("id,user_id,restaurant_id,name,email,role,active,created_at,updated_at")
      .eq("restaurant_id", auth.actor.restaurant_id)
      .order("name");
    if (result.error) return response("Não foi possível carregar a equipe.", 500);
    return NextResponse.json({ profiles: result.data });
  } catch {
    return response("Supabase não configurado no servidor.", 503);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticate(request);
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const role = body.role;
    const active = body.active !== false;

    if (!name || !email || !email.includes("@") || password.length < 8 || !isUserRole(role)) {
      return response("Preencha nome, email, senha provisória com 8 caracteres e cargo válido.", 400);
    }
    if (!canAssignRole(auth.actor.role, role)) {
      return response("Esse cargo não pode ser atribuído pelo seu perfil.", 403);
    }

    const created = await auth.admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name }
    });
    if (created.error || !created.data.user) {
      return response(created.error?.message ?? "Não foi possível criar o usuário.", 400);
    }

    const profileResult = await auth.admin
      .from("profiles")
      .insert({
        user_id: created.data.user.id,
        restaurant_id: auth.actor.restaurant_id,
        name,
        email,
        role,
        active
      })
      .select("id,user_id,restaurant_id,name,email,role,active,created_at,updated_at")
      .single();

    if (profileResult.error) {
      await auth.admin.auth.admin.deleteUser(created.data.user.id);
      return response("Não foi possível vincular o funcionário ao estabelecimento.", 500);
    }
    return NextResponse.json({ profile: profileResult.data }, { status: 201 });
  } catch {
    return response("Não foi possível processar a solicitação.", 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await authenticate(request);
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as Record<string, unknown>;
    const profileId = typeof body.profileId === "string" ? body.profileId : "";
    const active = body.active;
    if (!profileId || typeof active !== "boolean") return response("Alteração inválida.", 400);

    const targetResult = await auth.admin
      .from("profiles")
      .select("id,user_id,restaurant_id,role")
      .eq("id", profileId)
      .eq("restaurant_id", auth.actor.restaurant_id)
      .single();
    const target = targetResult.data as { id: string; user_id: string; role: UserRole } | null;
    if (targetResult.error || !target) return response("Funcionário não encontrado.", 404);
    if (target.user_id === auth.authUserId) return response("Você não pode desativar o próprio acesso.", 400);
    if (!canAssignRole(auth.actor.role, target.role)) {
      return response("Sem permissão para alterar esse funcionário.", 403);
    }

    const updated = await auth.admin
      .from("profiles")
      .update({ active })
      .eq("id", profileId)
      .eq("restaurant_id", auth.actor.restaurant_id)
      .select("id,user_id,restaurant_id,name,email,role,active,created_at,updated_at")
      .single();
    if (updated.error) return response("Não foi possível alterar o funcionário.", 500);
    return NextResponse.json({ profile: updated.data });
  } catch {
    return response("Não foi possível processar a solicitação.", 500);
  }
}

function response(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
