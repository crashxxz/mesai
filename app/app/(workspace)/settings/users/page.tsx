"use client";

import { FormEvent, useState } from "react";
import { UserPlus } from "lucide-react";
import { RoleGuard } from "@/components/role-guard";
import { Button } from "@/components/ui/button";
import { roleLabel } from "@/lib/permissions";
import { useStore } from "@/lib/store";
import type { UserRole } from "@/lib/types";

export default function UsersSettingsPage() {
  const { state, createProfile, updateProfile } = useStore();
  const [form, setForm] = useState({ name: "", email: "", role: "waiter" as UserRole });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return;
    createProfile(form.name.trim(), form.email.trim(), form.role);
    setForm({ name: "", email: "", role: "waiter" });
  }

  return (
    <RoleGuard allowed={["owner"]}>
      <section className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <form className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft" onSubmit={submit}>
          <h1 className="mb-3 text-xl font-black text-slate-950">Novo colaborador</h1>
          <div className="grid gap-2">
            <input
              className="h-12 rounded-lg border border-slate-200 px-3 text-sm font-bold"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Nome"
            />
            <input
              className="h-12 rounded-lg border border-slate-200 px-3 text-sm font-bold"
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="Email"
            />
            <select
              className="h-12 rounded-lg border border-slate-200 px-3 text-sm font-bold"
              value={form.role}
              onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as UserRole }))}
            >
              <option value="owner">Dono</option>
              <option value="waiter">Garçom</option>
              <option value="kitchen">Cozinha</option>
              <option value="bar">Bar</option>
            </select>
            <Button variant="amber" type="submit">
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Criar
            </Button>
          </div>
        </form>

        <div className="grid content-start gap-3">
          <div>
            <h1 className="text-2xl font-black text-slate-950">Equipe</h1>
            <p className="text-sm font-bold text-slate-500">Senha padrão: demo123</p>
          </div>
          {state.profiles.map((profile) => (
            <article key={profile.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
              <div className="grid gap-2 sm:grid-cols-[1fr_220px_120px]">
                <input
                  className="h-11 rounded-lg border border-slate-200 px-3 text-sm font-bold"
                  value={profile.name}
                  onChange={(event) => updateProfile(profile.id, { name: event.target.value })}
                />
                <select
                  className="h-11 rounded-lg border border-slate-200 px-3 text-sm font-bold"
                  value={profile.role}
                  onChange={(event) => updateProfile(profile.id, { role: event.target.value as UserRole })}
                >
                  <option value="owner">{roleLabel("owner")}</option>
                  <option value="waiter">{roleLabel("waiter")}</option>
                  <option value="kitchen">{roleLabel("kitchen")}</option>
                  <option value="bar">{roleLabel("bar")}</option>
                </select>
                <Button
                  variant={profile.active ? "outline" : "green"}
                  onClick={() => updateProfile(profile.id, { active: !profile.active })}
                >
                  {profile.active ? "Inativar" : "Ativar"}
                </Button>
              </div>
              <p className="mt-2 text-xs font-bold text-slate-500">{profile.email}</p>
            </article>
          ))}
        </div>
      </section>
    </RoleGuard>
  );
}
