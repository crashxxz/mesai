import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { canAssignRoles, canManageTeamRoles, isUserRole, normalizeUsername } from "@/lib/team-policy";
import type { UserRole } from "@/lib/types";

export const runtime = "nodejs";

interface ActorProfile {
  id: string;
  user_id: string;
  restaurant_id: string;
  role: UserRole;
  roles: UserRole[];
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret) throw new Error("Supabase não configurado no servidor.");
  return createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function authenticate(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { error: response("Sessão não encontrada.", 401) } as const;
  const admin = adminClient();
  const userResult = await admin.auth.getUser(token);
  if (userResult.error || !userResult.data.user) return { error: response("Sessão inválida.", 401) } as const;
  const profileResult = await admin
    .from("profiles")
    .select("id,user_id,restaurant_id,role,roles")
    .eq("user_id", userResult.data.user.id)
    .eq("active", true)
    .is("deleted_at", null)
    .single();
  const actor = profileResult.data as ActorProfile | null;
  const actorRoles = actor ? effectiveDbRoles(actor) : [];
  if (profileResult.error || !actor || !canManageTeamRoles(actorRoles)) {
    return { error: response("Sem permissão para gerenciar a equipe.", 403) } as const;
  }
  return { admin, actor, actorRoles, authUserId: userResult.data.user.id } as const;
}

const profileColumns = "id,user_id,restaurant_id,name,email,username,role,roles,active,deleted_at,created_at,updated_at";

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticate(request);
    if ("error" in auth) return auth.error;
    const result = await auth.admin.from("profiles").select(profileColumns)
      .eq("restaurant_id", auth.actor.restaurant_id).is("deleted_at", null).order("name");
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
    const username = normalizeUsername(typeof body.username === "string" ? body.username : "");
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const roles = Array.isArray(body.roles) ? [...new Set(body.roles.filter(isUserRole))] : [];
    const active = body.active !== false;
    if (!name || username.length < 3 || !/^[a-z0-9][a-z0-9._-]*$/.test(username) || password.length < 8 || !roles.length) {
      return response("Preencha nome, login válido, senha provisória com 8 caracteres e ao menos uma função.", 400);
    }
    if (email && !email.includes("@")) return response("Email inválido.", 400);
    if (!canAssignRoles(auth.actorRoles, roles)) return response("Você não pode atribuir essas funções.", 403);

    const restaurantResult = await auth.admin.from("restaurants").select("slug").eq("id", auth.actor.restaurant_id).single();
    if (restaurantResult.error) return response("Estabelecimento não encontrado.", 404);
    const technicalEmail = `${username}.${normalizeUsername(String(restaurantResult.data.slug))}@interno.mesai.local`;
    const authEmail = email || technicalEmail;
    const created = await auth.admin.auth.admin.createUser({
      email: authEmail, password, email_confirm: true, user_metadata: { name, username }
    });
    if (created.error || !created.data.user) return response(friendlyAuthError(created.error?.message), 400);
    if (!active) await auth.admin.auth.admin.updateUserById(created.data.user.id, { ban_duration: "876000h" });

    const profileResult = await auth.admin.from("profiles").insert({
      user_id: created.data.user.id,
      restaurant_id: auth.actor.restaurant_id,
      name,
      email: email || null,
      technical_email: technicalEmail,
      username,
      role: primaryRole(roles),
      roles,
      active
    }).select(profileColumns).single();
    if (profileResult.error) {
      await auth.admin.auth.admin.deleteUser(created.data.user.id);
      return response(profileResult.error.code === "23505" ? "Esse login já está em uso neste estabelecimento." : "Não foi possível vincular o funcionário.", 400);
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
    if (!profileId) return response("Alteração inválida.", 400);
    const target = await getTarget(auth.admin, auth.actor.restaurant_id, profileId);
    if (!target) return response("Funcionário não encontrado.", 404);
    const isSelf = target.user_id === auth.authUserId;
    const editing = typeof body.name === "string" || typeof body.username === "string" || Array.isArray(body.roles) || typeof body.email === "string";
    const roles = Array.isArray(body.roles) ? [...new Set(body.roles.filter(isUserRole))] : effectiveDbRoles(target);
    if (isSelf && (body.active === false || (Array.isArray(body.roles) && !roles.includes("owner") && !roles.includes("manager")))) return response("Você não pode remover o próprio acesso.", 400);
    if (!canAssignRoles(auth.actorRoles, effectiveDbRoles(target))) return response("Sem permissão para alterar esse funcionário.", 403);
    if (!canAssignRoles(auth.actorRoles, roles)) return response("Você não pode atribuir essas funções.", 403);
    const name = typeof body.name === "string" ? body.name.trim() : target.name;
    const username = typeof body.username === "string" ? normalizeUsername(body.username) : target.username;
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : target.email ?? "";
    if (editing && (!name || !username || username.length < 3 || !roles.length || (email && !email.includes("@")))) return response("Dados do funcionário inválidos.", 400);
    const restaurant = await auth.admin.from("restaurants").select("slug").eq("id", auth.actor.restaurant_id).single();
    const technicalEmail = `${username}.${normalizeUsername(String(restaurant.data?.slug ?? "mesai"))}@interno.mesai.local`;
    const active = typeof body.active === "boolean" ? body.active : target.active;
    const authUpdate = await auth.admin.auth.admin.updateUserById(target.user_id, {
      email: email || technicalEmail,
      ban_duration: active ? "none" : "876000h",
      user_metadata: { name, username }
    });
    if (authUpdate.error) return response("Não foi possível alterar o acesso no Auth.", 500);
    const updated = await auth.admin.from("profiles").update({ name, username, email: email || null, technical_email: technicalEmail, roles, role: primaryRole(roles), active }).eq("id", profileId)
      .eq("restaurant_id", auth.actor.restaurant_id).select(profileColumns).single();
    if (updated.error) return response("Não foi possível alterar o funcionário.", 500);
    return NextResponse.json({ profile: updated.data });
  } catch {
    return response("Não foi possível processar a solicitação.", 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await authenticate(request);
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as Record<string, unknown>;
    const profileId = typeof body.profileId === "string" ? body.profileId : "";
    const target = profileId ? await getTarget(auth.admin, auth.actor.restaurant_id, profileId) : null;
    if (!target) return response("Funcionário não encontrado.", 404);
    if (target.user_id === auth.authUserId) return response("Você não pode excluir a si mesmo.", 400);
    if (!canAssignRoles(auth.actorRoles, effectiveDbRoles(target))) return response("Sem permissão para excluir esse funcionário.", 403);
    const authUpdate = await auth.admin.auth.admin.updateUserById(target.user_id, { ban_duration: "876000h" });
    if (authUpdate.error) return response("Não foi possível bloquear o acesso no Auth.", 500);
    const removed = await auth.admin.from("profiles").update({ active: false, deleted_at: new Date().toISOString() })
      .eq("id", profileId).eq("restaurant_id", auth.actor.restaurant_id);
    if (removed.error) return response("Não foi possível excluir o funcionário.", 500);
    return NextResponse.json({ ok: true });
  } catch {
    return response("Não foi possível processar a solicitação.", 500);
  }
}

async function getTarget(admin: ReturnType<typeof adminClient>, restaurantId: string, profileId: string) {
  const result = await admin.from("profiles").select("id,user_id,name,email,username,role,roles,active,technical_email").eq("id", profileId)
    .eq("restaurant_id", restaurantId).is("deleted_at", null).single();
  return result.error ? null : result.data as { id: string; user_id: string; name: string; email: string | null; username: string; role: UserRole; roles: UserRole[]; active: boolean; technical_email: string };
}

function effectiveDbRoles(profile: { role: UserRole; roles?: UserRole[] | null }) {
  if (profile.role === "owner" || profile.roles?.includes("owner")) return ["owner"] as UserRole[];
  return profile.roles?.length ? profile.roles : [profile.role];
}

function primaryRole(roles: UserRole[]): UserRole {
  return (["owner", "manager", "cashier", "waiter", "kitchen", "bar"] as UserRole[]).find((role) => roles.includes(role)) ?? "waiter";
}

function friendlyAuthError(message?: string) {
  if (message?.toLowerCase().includes("registered")) return "Já existe um usuário com esse email ou login.";
  return message ?? "Não foi possível criar o usuário.";
}

function response(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
