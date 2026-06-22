"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Trash2, UserPlus, X } from "lucide-react";
import { RoleGuard } from "@/components/role-guard";
import { Button } from "@/components/ui/button";
import { effectiveRoles, roleLabel } from "@/lib/permissions";
import { runtimeConfig } from "@/lib/runtime-config";
import { useStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { canAssignRoles, normalizeUsername, userRoles } from "@/lib/team-policy";
import type { Profile, UserRole } from "@/lib/types";

const emptyForm = { name: "", username: "", email: "", password: "", roles: ["waiter"] as UserRole[], active: true };

export default function UsersSettingsPage() {
  const { state, profile: actor, restaurant, createProfile, updateProfile } = useStore();
  const [form, setForm] = useState(emptyForm);
  const [remoteProfiles, setRemoteProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(runtimeConfig.dataMode === "supabase");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const actorRoles = effectiveRoles(actor);
  const selectableRoles = useMemo(
    () => userRoles.filter((role) => role !== "owner" && canAssignRoles(actorRoles, [role])),
    [actorRoles]
  );
  const profiles = runtimeConfig.dataMode === "supabase"
    ? remoteProfiles
    : state.profiles.filter((item) => item.restaurantId === restaurant?.id && !item.deletedAt);

  const request = useCallback(async (method: "GET" | "POST" | "PATCH" | "DELETE", body?: object) => {
    const session = await supabase?.auth.getSession();
    const token = session?.data.session?.access_token;
    if (!token) throw new Error("Sessão não encontrada. Entre novamente.");
    const response = await fetch("/api/team", {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    const result = (await response.json()) as { error?: string; profile?: Record<string, unknown>; profiles?: Record<string, unknown>[] };
    if (!response.ok) throw new Error(result.error ?? "Não foi possível concluir a operação.");
    return result;
  }, []);

  const loadTeam = useCallback(async () => {
    if (runtimeConfig.dataMode !== "supabase") return;
    setLoading(true);
    try {
      const result = await request("GET");
      setRemoteProfiles((result.profiles ?? []).map(mapProfile));
      setError("");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => { void loadTeam(); }, [loadTeam]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true); setError(""); setMessage("");
    try {
      const payload = { ...form, username: normalizeUsername(form.username) };
      if (runtimeConfig.dataMode === "supabase") {
        const result = await request(editingId ? "PATCH" : "POST", editingId ? { profileId: editingId, name: payload.name, username: payload.username, email: payload.email, roles: payload.roles, active: payload.active } : payload);
        if (result.profile) setRemoteProfiles((current) => editingId ? current.map((item) => item.id === editingId ? mapProfile(result.profile!) : item) : [...current, mapProfile(result.profile!)].sort(sortByName));
      } else {
        if (editingId) updateProfile(editingId, { name: payload.name.trim(), username: payload.username, email: payload.email.trim(), roles: payload.roles, role: payload.roles.includes("manager") ? "manager" : payload.roles[0], active: payload.active });
        else createProfile(payload.name.trim(), payload.username, payload.email.trim(), payload.password, payload.roles, payload.active);
      }
      setForm(emptyForm);
      setEditingId("");
      setMessage(editingId ? "Funcionário atualizado." : "Funcionário criado.");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(target: Profile) {
    setError(""); setMessage("");
    try {
      if (runtimeConfig.dataMode === "supabase") {
        const result = await request("PATCH", { profileId: target.id, active: !target.active });
        if (result.profile) setRemoteProfiles((current) => current.map((item) => item.id === target.id ? mapProfile(result.profile!) : item));
      } else updateProfile(target.id, { active: !target.active });
      setMessage(target.active ? "Funcionário desativado." : "Funcionário ativado.");
    } catch (caught) { setError(errorMessage(caught)); }
  }

  async function remove(target: Profile) {
    if (!window.confirm(`Excluir ${target.name}? O acesso será bloqueado e o histórico preservado.`)) return;
    setError(""); setMessage("");
    try {
      if (runtimeConfig.dataMode === "supabase") {
        await request("DELETE", { profileId: target.id });
        setRemoteProfiles((current) => current.filter((item) => item.id !== target.id));
      } else updateProfile(target.id, { active: false, deletedAt: new Date().toISOString() });
      setMessage("Funcionário excluído. O histórico foi preservado.");
    } catch (caught) { setError(errorMessage(caught)); }
  }

  return (
    <RoleGuard allowed={["owner", "manager"]}>
      <section className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <form className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft" onSubmit={submit}>
          <div className="mb-3 flex items-center justify-between"><h1 className="text-xl font-black text-slate-950">{editingId ? "Editar colaborador" : "Novo colaborador"}</h1>{editingId ? <Button type="button" variant="ghost" size="icon" onClick={() => { setEditingId(""); setForm(emptyForm); }}><X className="h-4 w-4" /></Button> : null}</div>
          <div className="grid gap-2">
            <Field label="Nome"><input className={inputClass} value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} required /></Field>
            <Field label="Login/apelido"><input className={inputClass} value={form.username} onBlur={() => setForm((v) => ({ ...v, username: normalizeUsername(v.username) }))} onChange={(e) => setForm((v) => ({ ...v, username: e.target.value }))} placeholder="joao" minLength={3} required /></Field>
            <Field label="Email (opcional)"><input className={inputClass} type="email" value={form.email} onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))} /></Field>
            {!editingId ? <Field label="Senha provisória"><input className={inputClass} type="password" minLength={8} autoComplete="new-password" value={form.password} onChange={(e) => setForm((v) => ({ ...v, password: e.target.value }))} required /></Field> : null}
            <fieldset className="grid gap-2 rounded-lg border border-slate-200 p-3">
              <legend className="px-1 text-sm font-bold text-slate-700">Funções</legend>
              <div className="grid grid-cols-2 gap-2">
                {selectableRoles.map((role) => <label key={role} className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={form.roles.includes(role)} onChange={(e) => setForm((v) => ({ ...v, roles: e.target.checked ? [...v.roles, role] : v.roles.filter((item) => item !== role) }))} />{roleLabel(role)}</label>)}
              </div>
            </fieldset>
            <label className="flex min-h-12 items-center gap-3 rounded-lg border border-slate-200 px-3 text-sm font-bold"><input type="checkbox" checked={form.active} onChange={(e) => setForm((v) => ({ ...v, active: e.target.checked }))} />Ativo</label>
            <Button variant="amber" type="submit" disabled={saving || !form.roles.length}>{editingId ? <Pencil className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}{saving ? "Salvando..." : editingId ? "Salvar alterações" : "Criar"}</Button>
            {error ? <p className="text-sm font-bold text-red-700">{error}</p> : null}
            {message ? <p className="text-sm font-bold text-emerald-700">{message}</p> : null}
          </div>
        </form>

        <div className="grid content-start gap-3">
          <div><h1 className="text-2xl font-black text-slate-950">Equipe</h1><p className="text-sm font-bold text-slate-500">Acesso por login ou email.</p></div>
          {loading ? <p className="text-sm font-bold text-slate-500">Carregando equipe...</p> : null}
          {profiles.map((member) => {
            const memberRoles = effectiveRoles(member).filter((role) => role !== "owner");
            const allowed = member.id !== actor?.id && canAssignRoles(actorRoles, memberRoles.length ? memberRoles : [member.role]);
            return <article key={member.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><div className="font-black text-slate-950">{member.name}</div><p className="text-xs font-bold text-slate-500">@{member.username || "sem-login"}{member.email ? ` · ${member.email}` : ""}</p><div className="mt-2 flex flex-wrap gap-1">{memberRoles.map((role) => <span key={role} className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-black">{roleLabel(role)}</span>)}</div></div>
                <div className="flex gap-2"><Button variant="outline" size="icon" title="Editar" disabled={!allowed && member.id !== actor?.id} onClick={() => { setEditingId(member.id); setForm({ name: member.name, username: member.username ?? "", email: member.email, password: "", roles: member.roles?.length ? member.roles : [member.role], active: member.active }); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Pencil className="h-4 w-4" /></Button><Button variant={member.active ? "outline" : "green"} disabled={!allowed} onClick={() => void toggleActive(member)}>{member.active ? "Inativar" : "Ativar"}</Button><Button variant="danger" size="icon" title="Excluir" disabled={!allowed} onClick={() => void remove(member)}><Trash2 className="h-4 w-4" /></Button></div>
              </div>
            </article>;
          })}
        </div>
      </section>
    </RoleGuard>
  );
}

const inputClass = "h-12 rounded-lg border border-slate-200 px-3";
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-1 text-sm font-bold text-slate-700">{label}{children}</label>; }
function mapProfile(row: Record<string, unknown>): Profile { return { id: String(row.id), userId: String(row.user_id), restaurantId: String(row.restaurant_id), name: String(row.name), email: String(row.email ?? ""), username: String(row.username ?? ""), role: row.role as UserRole, roles: Array.isArray(row.roles) ? row.roles as UserRole[] : [row.role as UserRole], active: row.active === true, deletedAt: row.deleted_at ? String(row.deleted_at) : undefined, createdAt: String(row.created_at), updatedAt: String(row.updated_at) }; }
function sortByName(a: Profile, b: Profile) { return a.name.localeCompare(b.name, "pt-BR"); }
function errorMessage(error: unknown) { return error instanceof Error ? error.message : "Não foi possível concluir a operação."; }
