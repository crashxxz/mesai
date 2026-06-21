import type { UserRole } from "@/lib/types";

export const userRoles: UserRole[] = ["owner", "manager", "waiter", "kitchen", "bar", "cashier"];

const managerAssignableRoles: UserRole[] = ["waiter", "kitchen", "bar", "cashier"];

export function canManageTeam(role: UserRole) {
  return role === "owner" || role === "manager";
}

export function canManageTeamRoles(roles: UserRole[]) {
  return roles.includes("owner") || roles.includes("manager");
}

export function canAssignRole(actorRole: UserRole, targetRole: UserRole) {
  return actorRole === "owner" || (actorRole === "manager" && managerAssignableRoles.includes(targetRole));
}

export function canAssignRoles(actorRoles: UserRole[], targetRoles: UserRole[]) {
  if (!targetRoles.length || targetRoles.some((role) => !isUserRole(role))) return false;
  if (actorRoles.includes("owner")) return true;
  return actorRoles.includes("manager") && targetRoles.every((role) => managerAssignableRoles.includes(role));
}

export function normalizeUsername(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/^[._-]+|[._-]+$/g, "");
}

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && userRoles.includes(value as UserRole);
}
