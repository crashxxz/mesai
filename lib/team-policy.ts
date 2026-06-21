import type { UserRole } from "@/lib/types";

export const userRoles: UserRole[] = ["owner", "manager", "waiter", "kitchen", "bar", "cashier"];

const managerAssignableRoles: UserRole[] = ["waiter", "kitchen", "bar", "cashier"];

export function canManageTeam(role: UserRole) {
  return role === "owner" || role === "manager";
}

export function canAssignRole(actorRole: UserRole, targetRole: UserRole) {
  return actorRole === "owner" || (actorRole === "manager" && managerAssignableRoles.includes(targetRole));
}

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && userRoles.includes(value as UserRole);
}
