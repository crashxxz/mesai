export type DataMode = "demo" | "supabase";

const dataMode: DataMode = process.env.NEXT_PUBLIC_DATA_MODE === "supabase" ? "supabase" : "demo";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

export const runtimeConfig = {
  dataMode,
  appUrl: process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000",
  supabaseUrl,
  supabaseAnonKey,
  supabaseConfigured: Boolean(supabaseUrl && supabaseAnonKey)
} as const;

export function requireSupabaseConfiguration() {
  if (runtimeConfig.dataMode !== "supabase") {
    throw new Error("O modo de dados não está configurado como supabase.");
  }
  if (!runtimeConfig.supabaseConfigured) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY são obrigatórios no modo supabase.");
  }
}
