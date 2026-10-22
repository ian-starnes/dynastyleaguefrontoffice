import {
  Trophy,
  Users,
  BookUser,
  Wallet,
  ArrowLeftRight,
  ScrollText,
  Gavel,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

// Single source of truth for the left navigation. Add a route here and it
// appears in the sidebar automatically. League is the landing page ("/")
// — a public, league-wide view, not a per-person dashboard.
export const NAV_ITEMS: NavItem[] = [
  { label: "League", href: "/", icon: Trophy },
  { label: "Teams", href: "/teams", icon: Users },
  { label: "Managers", href: "/managers", icon: BookUser },
  { label: "Assets", href: "/assets", icon: Wallet },
  { label: "Trade Analyzer", href: "/trades", icon: ArrowLeftRight },
  { label: "History", href: "/history", icon: ScrollText },
  { label: "Constitution", href: "/constitution", icon: Gavel },
  { label: "Settings", href: "/settings", icon: Settings },
];
