"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChefHat, LogIn, Martini, ShieldCheck, UserRound } from "lucide-react";
import { BrandMark, BrandName } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { brand } from "@/lib/brand";
import { runtimeConfig } from "@/lib/runtime-config";
import { useStore } from "@/lib/store";
import type { UserRole } from "@/lib/types";

const rolePath: Record<UserRole, string> = {
  owner: "/app/dashboard",
  manager: "/app/dashboard",
  waiter: "/app/tables",
  kitchen: "/app/kitchen",
  bar: "/app/bar",
  cashier: "/app/cash"
};

const quickUsers = [
  { label: "Entrar como Dono", email: "dono@mesai.demo", role: "owner" as const, icon: ShieldCheck, color: "border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-900" },
  { label: "Entrar como Garçom", email: "garcom@mesai.demo", role: "waiter" as const, icon: UserRound, color: "border-sky-200 bg-sky-50 hover:bg-sky-100 text-sky-900" },
  { label: "Entrar como Cozinha", email: "cozinha@mesai.demo", role: "kitchen" as const, icon: ChefHat, color: "border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-900" },
  { label: "Entrar como Bar", email: "bar@mesai.demo", role: "bar" as const, icon: Martini, color: "border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-900" }
];

export default function LoginPage() {
  const router = useRouter();
  const { hydrated, login, profile } = useStore();
  const [email, setEmail] = useState(runtimeConfig.dataMode === "demo" ? "dono@mesai.demo" : "");
  const [password, setPassword] = useState(runtimeConfig.dataMode === "demo" ? "demo123" : "");
  const [error, setError] = useState("");
  const [remember, setRemember] = useState(true);

  useEffect(() => {
    if (hydrated && profile) router.replace(rolePath[profile.role]);
  }, [hydrated, profile, router]);

  useEffect(() => {
    if (runtimeConfig.dataMode !== "supabase") return;
    const saved = localStorage.getItem("mesai-login-identifier");
    const shouldRemember = localStorage.getItem("mesai-remember-access") !== "0";
    setRemember(shouldRemember);
    if (saved && shouldRemember) setEmail(saved);
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      localStorage.setItem("mesai-remember-access", remember ? "1" : "0");
      if (remember) localStorage.setItem("mesai-login-identifier", email.trim());
      else localStorage.removeItem("mesai-login-identifier");
      const identifier = runtimeConfig.dataMode === "supabase" && !email.includes("@") ? await resolveLogin(email) : email;
      const authenticatedProfile = await login(identifier, password);
      if (!authenticatedProfile) {
        setError("Email, login ou senha inválidos.");
        return;
      }
      router.replace(rolePath[authenticatedProfile.role]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível entrar. Tente novamente.");
    }
  }

  return (
    <main className="login-bg grid min-h-screen place-items-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <BrandMark className="mx-auto mb-4 h-[72px] w-[72px] drop-shadow-[0_12px_24px_rgba(17,24,39,0.16)]" />
          <h1><BrandName className="text-4xl" /></h1>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            {brand.slogan}
          </p>
        </div>

        <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-soft-lg">
          {runtimeConfig.dataMode === "demo" ? (
            <p className="mb-4 rounded-2xl bg-amber-50 p-3 text-sm font-black text-amber-900">
              Escolha um perfil para testar o sistema.
            </p>
          ) : null}
          <form className="grid gap-4" onSubmit={submit}>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              Email ou login
              <input
                className="h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 outline-none transition focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-400/20"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="text"
                autoComplete="username"
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-600"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />Lembrar acesso neste dispositivo</label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              Senha
              <input
                className="h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 outline-none transition focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-400/20"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                autoComplete="current-password"
              />
            </label>
            {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
            <Button variant="amber" size="lg" type="submit" className="mt-1 rounded-xl text-base">
              <LogIn className="h-4 w-4" aria-hidden="true" />
              Entrar
            </Button>
          </form>
        </section>

        {runtimeConfig.dataMode === "demo" ? <div className="mt-6">
          <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-400">
            Acesso rápido (demo)
          </p>
          <div className="grid grid-cols-2 gap-2">
            {quickUsers.map((user) => {
              const Icon = user.icon;
              return (
                <button
                  key={user.email}
                  type="button"
                  className={`flex min-h-12 items-center gap-2 rounded-xl border px-3 text-sm font-bold transition active:scale-[0.97] ${user.color}`}
                  onClick={async () => {
                    setEmail(user.email);
                    setPassword("demo123");
                    const authenticatedProfile = await login(user.email, "demo123");
                    if (authenticatedProfile) {
                      router.replace(rolePath[authenticatedProfile.role]);
                    }
                  }}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{user.label}</span>
                </button>
              );
            })}
          </div>
        </div> : null}
      </div>
    </main>
  );
}

async function resolveLogin(username: string) {
  const response = await fetch("/api/auth/resolve-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username })
  });
  const result = await response.json() as { email?: string; error?: string };
  if (!response.ok || !result.email) throw new Error(result.error ?? "Login não encontrado.");
  return result.email;
}
