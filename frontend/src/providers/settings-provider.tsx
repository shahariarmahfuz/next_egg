"use client";

import { useEffect } from "react";
import { useSettingsStore } from "@/store/settings";
import { apiClient } from "@/lib/api-client";

import { STATIC_CURRENCIES, DEFAULT_CURRENCY } from "@/lib/currencies";
import { DEFAULT_BRAND_NAME, resolveBrandingAssets } from "@/lib/branding";
import { normalizeDateFormat, normalizeTimeFormat } from "@/utils/formatters";

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
          const dateFormat = normalizeDateFormat(response.data.date_format);
          const timeFormat = normalizeTimeFormat(response.data.time_format);
          setSettings({
            ...response.data,
            date_format: dateFormat,
            time_format: timeFormat,
            currency,
          });
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
    if (!isLoaded) return;

    document.title = settings.business_name?.trim() || DEFAULT_BRAND_NAME;

    const resolved = resolveBrandingAssets(settings);

    let iconLink: HTMLLinkElement | null = document.querySelector("link[rel='icon']");
    if (!iconLink) {
      iconLink = document.createElement("link");
      iconLink.rel = "icon";
      document.head.appendChild(iconLink);
    }
    iconLink.href = resolved.favicon;

    let appleLink: HTMLLinkElement | null = document.querySelector("link[rel='apple-touch-icon']");
    if (!appleLink) {
      appleLink = document.createElement("link");
      appleLink.rel = "apple-touch-icon";
      document.head.appendChild(appleLink);
    }
    appleLink.href = resolved.appIcon;
  }, [settings, settings.business_name, settings.favicon_url, settings.app_icon_url, isLoaded]);

  // Wait until settings are loaded to prevent hydration mismatch with formats
  if (!isLoaded) {
    return null; // Or a loading spinner
  }

  return <>{children}</>;
}
