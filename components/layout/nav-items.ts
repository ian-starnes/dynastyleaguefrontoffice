export type NavItem = {
  label: string;
  href: string;
};

// Single source of truth for the left navigation. Add a route here and it
// appears in the sidebar automatically.
export const NAV_ITEMS: NavItem[] = [
  { label: "Front Office", href: "/" },
  { label: "League", href: "/league" },
  { label: "Teams", href: "/teams" },
  { label: "Players", href: "/players" },
  { label: "Trades", href: "/trades" },
  { label: "Settings", href: "/settings" },
];
