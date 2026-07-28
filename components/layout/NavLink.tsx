"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type NavLinkProps = {
  label: string;
  href: string;
  /**
   * Pre-rendered icon element, not the icon component itself — a component
   * reference is a function and can't cross the server/client boundary as a
   * prop, but an already-rendered element can.
   */
  icon: ReactNode;
};

/**
 * A single sidebar entry. Reads the current route via `usePathname` so the
 * active item can carry the "subtle green highlight" called for in the brief.
 */
export function NavLink({ label, href, icon }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={`flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
        isActive
          ? "bg-primary/[0.08] text-primary"
          : "text-ink/60 hover:bg-black/[0.03] hover:text-ink"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}
