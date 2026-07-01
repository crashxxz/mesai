import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedProfile, getPushAdmin } from "@/lib/push-server";

interface SubscribeBody {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
}

export async function POST(request: NextRequest) {
  const supabase = getPushAdmin();
  if (!supabase) return NextResponse.json({ error: "Push não configurado" }, { status: 500 });

  const profile = await getAuthenticatedProfile(request, supabase);
  if (!profile) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });

  const body = await request.json() as SubscribeBody;
  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
  }

  const { error } = await supabase.from("push_subscriptions").upsert({
    user_id: profile.userId,
    restaurant_id: profile.restaurantId,
    role: profile.role,
    roles: profile.roles,
    endpoint: body.endpoint,
    p256dh: body.keys.p256dh,
    auth: body.keys.auth,
    user_agent: request.headers.get("user-agent") ?? null,
    enabled: true,
    disabled_at: null,
    last_error: null,
    updated_at: new Date().toISOString()
  }, { onConflict: "endpoint" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = getPushAdmin();
  if (!supabase) return NextResponse.json({ error: "Push não configurado" }, { status: 500 });

  const profile = await getAuthenticatedProfile(request, supabase);
  if (!profile) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { endpoint?: string };
  if (!body.endpoint) return NextResponse.json({ error: "Endpoint ausente" }, { status: 400 });

  await supabase
    .from("push_subscriptions")
    .update({ enabled: false, disabled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("endpoint", body.endpoint)
    .eq("user_id", profile.userId);

  return NextResponse.json({ ok: true });
}
