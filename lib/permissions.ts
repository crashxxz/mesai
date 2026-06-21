import type { Profile, UserRole } from "@/lib/types";

const roleWeight: Record<UserRole, number> = {
  owner: 6,
  manager: 5,
  cashier: 4,
  waiter: 3,
  kitchen: 2,
  bar: 2
};

export function canAccess(profile: Profile | undefined, allowed: UserRole[]) {
  return Boolean(profile?.active && allowed.includes(profile.role));
}

export function canSeeFinance(profile: Profile | undefined) {
  return profile?.role === "owner" || profile?.role === "manager";
}

export function canCloseAccount(profile: Profile | undefined, waiterAllowed: boolean) {
  return ["owner", "manager", "cashier"].includes(profile?.role ?? "") || (profile?.role === "waiter" && waiterAllowed);
}

export function canManageProducts(profile: Profile | undefined) {
  return profile?.role === "owner" || profile?.role === "manager";
}

export function roleLabel(role: UserRole) {
  const labels: Record<UserRole, string> = {
    owner: "Dono",
    manager: "Gerente",
    waiter: "Garçom",
    kitchen: "Cozinha",
    bar: "Bar",
    cashier: "Caixa"
  };
  return labels[role];
}

export function highestRole(roles: UserRole[]) {
  return [...roles].sort((a, b) => roleWeight[b] - roleWeight[a])[0];
}
