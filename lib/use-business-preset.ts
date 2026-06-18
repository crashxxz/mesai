"use client";

import { useEffect, useMemo, useState } from "react";
import {
  businessProfileStorageKey,
  defaultBusinessProfile,
  getBusinessPreset,
  type BusinessProfile
} from "@/lib/business-presets";

const changeEventName = "mesai-business-profile-changed";

function readBusinessProfile(): BusinessProfile {
  if (typeof window === "undefined") return defaultBusinessProfile;
  const stored = window.localStorage.getItem(businessProfileStorageKey);
  return getBusinessPreset(stored ?? undefined).id;
}

export function useBusinessPreset() {
  const [profile, setProfile] = useState<BusinessProfile>(defaultBusinessProfile);

  useEffect(() => {
    setProfile(readBusinessProfile());

    function sync() {
      setProfile(readBusinessProfile());
    }

    window.addEventListener("storage", sync);
    window.addEventListener(changeEventName, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(changeEventName, sync);
    };
  }, []);

  const preset = useMemo(() => getBusinessPreset(profile), [profile]);

  function setBusinessProfile(nextProfile: BusinessProfile) {
    window.localStorage.setItem(businessProfileStorageKey, nextProfile);
    setProfile(nextProfile);
    window.dispatchEvent(new Event(changeEventName));
  }

  return { profile, preset, setBusinessProfile };
}
