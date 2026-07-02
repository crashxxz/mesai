import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedProfile, getPushAdmin, sendPushToRoles } from "@/lib/push-server";

export async function POST(request: NextRequest) {
  const supabase = getPushAdmin();
  if (!supabase) return NextResponse.json({ error: "Push não configurado" }, { status: 500 });

  const profile = await getAuthenticatedProfile(request, supabase);
  if (!profile) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });

  const result = await sendPushToRoles(supabase, {
    restaurantId: profile.restaurantId,
    roles: profile.roles,
    title: "Teste MesaY",
    body: "Notificações push funcionando neste dispositivo.",
    url: "/app/dashboard",
    tag: `test-${profile.userId}`
  });

  if (!result.configured) return NextResponse.json({ error: "VAPID não configurado" }, { status: 500 });
  return NextResponse.json(result);
}
