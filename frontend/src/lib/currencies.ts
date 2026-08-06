import { Currency } from "@/store/settings";

export const STATIC_CURRENCIES: Currency[] = [
  { id: "BDT", name: "Bangladeshi Taka", code: "BDT", symbol: "৳", symbol_position: "before", decimal_places: 2 },
  { id: "USD", name: "US Dollar", code: "USD", symbol: "$", symbol_position: "before", decimal_places: 2 },
  { id: "INR", name: "Indian Rupee", code: "INR", symbol: "₹", symbol_position: "before", decimal_places: 2 },
  { id: "EUR", name: "Euro", code: "EUR", symbol: "€", symbol_position: "before", decimal_places: 2 },
  { id: "SAR", name: "Saudi Riyal", code: "SAR", symbol: "﷼", symbol_position: "before", decimal_places: 2 },
];

export const DEFAULT_CURRENCY = STATIC_CURRENCIES[0];
