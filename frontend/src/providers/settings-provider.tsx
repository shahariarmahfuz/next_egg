"use client";

import { useEffect } from "react";
import { useSettingsStore } from "@/store/settings";
import { apiClient } from "@/lib/api-client";

interface SettingsProviderProps {
  children: React.ReactNode;
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  const { setSettings, setLoaded, isLoaded } = useSettingsStore();

  useEffect(() => {
    async function loadSettings() {
      try {
        const response = await apiClient("/settings/business");
        if (response.data) {
          setSettings(response.data);
        }
      } catch (error) {
        console.error("Failed to load business settings:", error);
      } finally {
        setLoaded(true);
      }
    }
    
    if (!isLoaded) {
      loadSettings();
    }
  }, [setSettings, setLoaded, isLoaded]);

  // Wait until settings are loaded to prevent hydration mismatch with formats
  if (!isLoaded) {
    return null; // Or a loading spinner
  }

  return <>{children}</>;
}
