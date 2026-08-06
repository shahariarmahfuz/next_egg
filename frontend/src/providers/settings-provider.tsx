"use client";

import { useEffect } from "react";
import { useSettingsStore } from "@/store/settings";
import { apiClient } from "@/lib/api-client";

import { STATIC_CURRENCIES, DEFAULT_CURRENCY } from "@/lib/currencies";

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
          const defaultCurrencyId = response.data.default_currency_id;
          const currency = STATIC_CURRENCIES.find((c) => c.id === defaultCurrencyId) || DEFAULT_CURRENCY;
          setSettings({ ...response.data, currency });
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

  const { settings } = useSettingsStore();
  useEffect(() => {
    if (isLoaded && settings.business_name) {
      document.title = settings.business_name;
    }
  }, [settings.business_name, isLoaded]);

  // Wait until settings are loaded to prevent hydration mismatch with formats
  if (!isLoaded) {
    return null; // Or a loading spinner
  }

  return <>{children}</>;
}
