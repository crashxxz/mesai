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
  return Boolean(profile?.active && effectiveRoles(profile).some((role) => allowed.includes(role)));
}

export function canSeeFinance(profile: Profile | undefined) {
  return canAccess(profile, ["owner", "manager"]);
}

export function canCloseAccount(profile: Profile | undefined, waiterAllowed: boolean) {
  return canAccess(profile, ["owner", "manager", "cashier"]) || (canAccess(profile, ["waiter"]) && waiterAllowed);
}

export function canManageProducts(profile: Profile | undefined) {
  return canAccess(profile, ["owner", "manager"]);
}

export function effectiveRoles(profile: Profile | undefined): UserRole[] {
  if (!profile) return [];
  if (profile.role === "owner" || profile.roles?.includes("owner")) {
    return ["owner", "manager", "waiter", "kitchen", "bar", "cashier"];
  }
  return profile.roles?.length ? [...new Set(profile.roles)] : [profile.role];
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
