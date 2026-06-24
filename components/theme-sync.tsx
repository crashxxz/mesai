"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";

type Theme = "light" | "dark" | "system";

function resolvedTheme(preference: Theme) {
  if (preference !== "system") return preference;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Keeps the selected restaurant theme on every route, including login and QR pages. */
export function ThemeSync() {
  const { settings } = useStore();
  const preference = settings?.systemTheme ?? "system";

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
