import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { normalizeUsername } from "@/lib/team-policy";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const username = normalizeUsername(String((await request.json() as { username?: string }).username ?? ""));
    if (username.length < 3) return NextResponse.json({ error: "Login inválido." }, { status: 400 });
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const secret = process.env.SUPABASE_SECRET_KEY?.trim();
    if (!url || !secret) return NextResponse.json({ error: "Login por apelido não configurado." }, { status: 503 });
    const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
    const result = await admin.from("profiles").select("email,technical_email").eq("username", username)
      .eq("active", true).is("deleted_at", null).limit(2);
    if (result.error || !result.data?.length) return NextResponse.json({ error: "Login não encontrado." }, { status: 404 });
    if (result.data.length > 1) return NextResponse.json({ error: "Login repetido. Entre com seu email." }, { status: 409 });
    return NextResponse.json({ email: result.data[0].email || result.data[0].technical_email });
  } catch {
    return NextResponse.json({ error: "Não foi possível localizar o login." }, { status: 500 });
  }
}
