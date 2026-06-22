import { createClient } from "@supabase/supabase-js";
import { runtimeConfig } from "@/lib/runtime-config";

const authStorage = {
  getItem(key: string) {
    if (typeof window === "undefined") return null;
    const preferred = localStorage.getItem("mesai-remember-access") === "1" ? localStorage : sessionStorage;
    return preferred.getItem(key) ?? localStorage.getItem(key) ?? sessionStorage.getItem(key);
  },
  setItem(key: string, value: string) {
    if (typeof window === "undefined") return;
    const remember = localStorage.getItem("mesai-remember-access") === "1";
    (remember ? localStorage : sessionStorage).setItem(key, value);
    (remember ? sessionStorage : localStorage).removeItem(key);
  },
  removeItem(key: string) {
    if (typeof window === "undefined") return;
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }
};

export const supabase =
  runtimeConfig.dataMode === "supabase" && runtimeConfig.supabaseConfigured
    ? createClient(runtimeConfig.supabaseUrl, runtimeConfig.supabaseAnonKey, {
        auth: {
          persistSession: true,
          storage: authStorage,
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
