import {
  Landmark,
  Trophy,
  Users,
  Wallet,
  ArrowLeftRight,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

// Single source of truth for the left navigation. Add a route here and it
// appears in the sidebar automatically.
export const NAV_ITEMS: NavItem[] = [
  { label: "Front Office", href: "/", icon: Landmark },
  { label: "League", href: "/league", icon: Trophy },
  { label: "Teams", href: "/teams", icon: Users },
  { label: "Assets", href: "/assets", icon: Wallet },
  { label: "Trades", href: "/trades", icon: ArrowLeftRight },
  { label: "Settings", href: "/settings", icon: Settings },
];
