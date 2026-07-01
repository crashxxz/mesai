import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import webpush, { type PushSubscription } from "web-push";
import type { NextRequest } from "next/server";
import type { PreparationSector, UserRole } from "@/lib/types";

type PushTable = {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: [];
};
type PushDatabase = {
  public: {
    Tables: Record<string, PushTable>;
    Views: Record<string, PushTable>;
    Functions: Record<string, { Args: Record<string, unknown>; Returns: unknown }>;
    Enums: Record<string, string>;
    CompositeTypes: Record<string, unknown>;
  };
};
type SupabaseAdmin = SupabaseClient<PushDatabase>;

export interface PushMessage {
  restaurantId: string;
  roles: UserRole[];
  title: string;
  body: string;
  url?: string;
  tag: string;
}

export interface AuthenticatedProfile {
  userId: string;
  profileId: string;
  restaurantId: string;
  role: UserRole;
  roles: UserRole[];
}

export function getPushAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return createClient<PushDatabase>(url, key, { auth: { persistSession: false } });
}

function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.WEB_PUSH_SUBJECT?.trim() || "mailto:contato@mesay.app";
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

export async function getAuthenticatedProfile(request: NextRequest, supabase: SupabaseAdmin): Promise<AuthenticatedProfile | null> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id,user_id,restaurant_id,role,roles,active")
    .eq("user_id", user.id)
    .eq("active", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !profile) return null;
  const primaryRole = String(profile.role) as UserRole;
  const roles = Array.isArray(profile.roles) && profile.roles.length
    ? profile.roles.map(String) as UserRole[]
    : [primaryRole];

  return {
    userId: user.id,
    profileId: String(profile.id),
    restaurantId: String(profile.restaurant_id),
    role: primaryRole,
    roles
  };
}

export function rolesForPreparationSector(sector: PreparationSector): UserRole[] {
  if (sector === "bar") return ["bar", "kitchen"];
  if (sector === "both") return ["bar", "kitchen"];
  if (sector === "kitchen") return ["kitchen"];
  return [];
}

export async function sendPushToRoles(supabase: SupabaseAdmin, message: PushMessage) {
  if (!configureWebPush()) return { sent: 0, expired: 0, configured: false };
  const roles = [...new Set(message.roles)].filter(Boolean);
  if (!message.restaurantId || !roles.length || !message.title.trim()) return { sent: 0, expired: 0, configured: true };

  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("id,endpoint,p256dh,auth,role,roles")
    .eq("restaurant_id", message.restaurantId)
    .eq("enabled", true);

  const selected = (subscriptions ?? [])
    .filter((sub) => {
      const subRoles = Array.isArray(sub.roles) && sub.roles.length ? sub.roles.map(String) : [String(sub.role)];
      return subRoles.some((role) => roles.includes(role as UserRole));
    })
    .filter((sub, index, all) => all.findIndex((item) => item.endpoint === sub.endpoint) === index);

  if (!selected.length) return { sent: 0, expired: 0, configured: true };

  const notification = JSON.stringify({
    title: message.title,
    body: message.body,
    url: message.url ?? "/app/tables",
    tag: `mesay-${message.restaurantId}-${message.tag}`
  });

  let sent = 0;
  const expired: string[] = [];

  for (const sub of selected) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } } as PushSubscription,
        notification
      );
      sent++;
    } catch (error) {
      const statusCode = (error as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) expired.push(String(sub.id));
    }
  }

  if (expired.length) {
    await supabase
      .from("push_subscriptions")
      .update({ enabled: false, disabled_at: new Date().toISOString(), last_error: "expired" })
      .in("id", expired);
  }

  return { sent, expired: expired.length, configured: true };
}
