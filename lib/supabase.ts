import { createClient } from "@supabase/supabase-js";
import { runtimeConfig } from "@/lib/runtime-config";

export const supabase =
  runtimeConfig.dataMode === "supabase" && runtimeConfig.supabaseConfigured
    ? createClient(runtimeConfig.supabaseUrl, runtimeConfig.supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        },
        realtime: {
          params: {
            eventsPerSecond: 10
          }
        }
      })
    : null;
