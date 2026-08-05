import { ComponentType } from "react";

export interface NavItem {
  title: string;
  href: string;
  icon?: ComponentType<{ className?: string }>;
  disabled?: boolean;
  external?: boolean;
  badge?: string;
  children?: NavItem[];
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}
