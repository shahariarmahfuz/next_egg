import { create } from 'zustand';

export interface Currency {
  id?: string;
  name: string;
  code: string;
  symbol: string;
  symbol_position: "before" | "after";
  decimal_places: number;
}

export interface BusinessSettings {
  business_name: string;
  timezone: string;
  date_format: string;
  time_format: string;
  thousand_separator: string;
  decimal_separator: string;
  currency: Currency;
}

const defaultSettings: BusinessSettings = {
  business_name: "Business",
  timezone: "UTC",
  date_format: "MMM dd, yyyy",
  time_format: "hh:mm a",
  thousand_separator: ",",
  decimal_separator: ".",
  currency: {
    name: "US Dollar",
    code: "USD",
    symbol: "$",
    symbol_position: "before",
    decimal_places: 2,
  },
};

interface SettingsState {
  settings: BusinessSettings;
  setSettings: (settings: BusinessSettings) => void;
  isLoaded: boolean;
  setLoaded: (loaded: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: defaultSettings,
  setSettings: (settings) => set({ settings }),
  isLoaded: false,
  setLoaded: (isLoaded) => set({ isLoaded }),
}));
