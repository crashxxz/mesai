"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";

type Theme = "light" | "dark" | "system";
export const localThemePreferenceKey = "mesay-theme-preference";

function resolvedTheme(preference: Theme) {
  if (preference !== "system") return preference;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Keeps the selected restaurant theme on every route, including login and QR pages. */
export function ThemeSync() {
  const { settings } = useStore();
  const [localPreference, setLocalPreference] = useState<Theme>();
  const preference = localPreference ?? settings?.systemTheme ?? "system";

  useEffect(() => {
    const load = () => {
      const saved = localStorage.getItem(localThemePreferenceKey);
      setLocalPreference(saved === "light" || saved === "dark" || saved === "system" ? saved : undefined);
    };
    load();
    window.addEventListener("mesay-theme-change", load);
    return () => window.removeEventListener("mesay-theme-change", load);
  }, []);

  useEffect(() => {
    const apply = () => {
      const theme = resolvedTheme(preference);
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme;
    };

    apply();
    if (preference !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [preference]);

  return null;
}
