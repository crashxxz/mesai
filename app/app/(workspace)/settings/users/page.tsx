"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { UserPlus } from "lucide-react";
import { RoleGuard } from "@/components/role-guard";
import { Button } from "@/components/ui/button";
import { roleLabel } from "@/lib/permissions";
import { runtimeConfig } from "@/lib/runtime-config";
import { useStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { canAssignRole, userRoles } from "@/lib/team-policy";
import type { Profile, UserRole } from "@/lib/types";

const initialForm = { name: "", email: "", password: "", role: "waiter" as UserRole, active: true };

export default function UsersSettingsPage() {
  const { state, profile: actor, restaurant, createProfile, updateProfile } = useStore();
  const [form, setForm] = useState(initialForm);
  const [remoteProfiles, setRemoteProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(runtimeConfig.dataMode === "supabase");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const assignableRoles = useMemo(
    () => userRoles.filter((role) => actor && canAssignRole(actor.role, role)),
    [actor]
  );
  const profiles = runtimeConfig.dataMode === "supabase"
    ? remoteProfiles
    : state.profiles.filter((item) => item.restaurantId === restaurant?.id);

  const request = useCallback(async (method: "GET" | "POST" | "PATCH", body?: object) => {
    const session = await supabase?.auth.getSession();
    const token = session?.data.session?.access_token;
    if (!token) throw new Error("Sessão não encontrada. Entre novamente.");
    const response = await fetch("/api/team", {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {})
      },
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

  useEffect(() => {
    void loadTeam();
  }, [loadTeam]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      if (runtimeConfig.dataMode === "supabase") {
        const result = await request("POST", form);
        if (result.profile) setRemoteProfiles((current) => [...current, mapProfile(result.profile!)].sort(sortByName));
      } else {
        createProfile(form.name.trim(), form.email.trim(), form.password, form.role, form.active);
      }
      setForm(initialForm);
      setMessage("Funcionário criado.");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(target: Profile) {
    setError("");
    setMessage("");
    try {
      if (runtimeConfig.dataMode === "supabase") {
        const result = await request("PATCH", { profileId: target.id, active: !target.active });
        if (result.profile) {
          const updated = mapProfile(result.profile);
          setRemoteProfiles((current) => current.map((item) => item.id === updated.id ? updated : item));
        }
      } else {
        updateProfile(target.id, { active: !target.active });
      }
      setMessage(target.active ? "Funcionário desativado." : "Funcionário ativado.");
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  return (
    <RoleGuard allowed={["owner", "manager"]}>
      <section className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <form className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft" onSubmit={submit}>
          <h1 className="mb-3 text-xl font-black text-slate-950">Novo colaborador</h1>
          <div className="grid gap-2">
            <label className="grid gap-1 text-sm font-bold text-slate-700">
              Nome
              <input className="h-12 rounded-lg border border-slate-200 px-3" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
            </label>
            <label className="grid gap-1 text-sm font-bold text-slate-700">
              Email
              <input className="h-12 rounded-lg border border-slate-200 px-3" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required />
            </label>
            <label className="grid gap-1 text-sm font-bold text-slate-700">
              Senha provisória
              <input className="h-12 rounded-lg border border-slate-200 px-3" type="password" minLength={8} autoComplete="new-password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} required />
            </label>
            <label className="grid gap-1 text-sm font-bold text-slate-700">
              Cargo
              <select className="h-12 rounded-lg border border-slate-200 px-3" value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as UserRole }))}>
                {assignableRoles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}
              </select>
            </label>
            <label className="flex min-h-12 items-center gap-3 rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-700">
              <input type="checkbox" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} />
              Ativo
            </label>
            <Button variant="amber" type="submit" disabled={saving}>
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              {saving ? "Criando..." : "Criar"}
            </Button>
            {error ? <p className="text-sm font-bold text-red-700">{error}</p> : null}
            {message ? <p className="text-sm font-bold text-emerald-700">{message}</p> : null}
          </div>
        </form>

        <div className="grid content-start gap-3">
          <div>
            <h1 className="text-2xl font-black text-slate-950">Equipe</h1>
            <p className="text-sm font-bold text-slate-500">Funcionários vinculados a este estabelecimento.</p>
          </div>
          {loading ? <p className="text-sm font-bold text-slate-500">Carregando equipe...</p> : null}
          {!loading && !profiles.length ? <p className="rounded-lg border border-dashed border-slate-200 p-5 text-sm font-bold text-slate-500">Nenhum funcionário encontrado.</p> : null}
          {profiles.map((profile) => {
            const canToggle = profile.id !== actor?.id && Boolean(actor && canAssignRole(actor.role, profile.role));
            return (
              <article key={profile.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-black text-slate-950">{profile.name}</div>
                    <p className="text-xs font-bold text-slate-500">{profile.email}</p>
                    <p className="mt-1 text-xs font-black text-slate-600">{roleLabel(profile.role)} · {profile.active ? "Ativo" : "Inativo"}</p>
                  </div>
                  <Button variant={profile.active ? "outline" : "green"} disabled={!canToggle} onClick={() => void toggleActive(profile)}>
                    {profile.active ? "Inativar" : "Ativar"}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </RoleGuard>
  );
}

function mapProfile(row: Record<string, unknown>): Profile {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    restaurantId: String(row.restaurant_id),
    name: String(row.name),
    email: String(row.email ?? ""),
    role: row.role as UserRole,
    active: row.active === true,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function sortByName(a: Profile, b: Profile) {
  return a.name.localeCompare(b.name, "pt-BR");
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Não foi possível concluir a operação.";
}
