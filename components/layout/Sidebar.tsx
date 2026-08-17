"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { NAV_ITEMS } from "./nav-items";
import { NavLink } from "./NavLink";

/**
 * Left-hand navigation column. Fixed on large screens so it stays put
 * while the main content scrolls. On small screens it collapses to a
 * compact top bar with a hamburger toggle — the nav list expands
 * in-place below it rather than as an overlay, keeping this simple
 * (no z-index/portal complexity) while still not eating the whole
 * screen before any page content is visible.
 */
export function Sidebar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <aside className="border-b border-black/5 lg:fixed lg:inset-y-0 lg:left-0 lg:w-72 lg:border-b-0 lg:border-r">
      <div className="flex items-center justify-between px-6 py-5 lg:hidden">
        <Link
          href="/"
          className="flex items-center gap-3"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <span aria-hidden className="h-7 w-[3px] rounded-full bg-gold" />
          <span className="font-serif text-2xl font-semibold tracking-tight text-primary">
            DLFO
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen((open) => !open)}
          aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={isMobileMenuOpen}
          className="rounded-lg p-2 text-ink/60 hover:bg-black/[0.04] hover:text-ink"
        >
          {isMobileMenuOpen ? (
            <X className="h-5 w-5" strokeWidth={1.75} />
          ) : (
            <Menu className="h-5 w-5" strokeWidth={1.75} />
          )}
        </button>
      </div>

      <div
        className={`px-6 pb-6 lg:flex lg:h-full lg:flex-col lg:px-8 lg:py-10 ${
          isMobileMenuOpen ? "block" : "hidden lg:flex"
        }`}
      >
        <Link href="/" className="hidden items-center gap-3 lg:flex">
          {/* Stand-in brand mark until a real wordmark/logo exists */}
          <span aria-hidden className="h-8 w-[3px] rounded-full bg-gold" />
          <span className="block">
            <span className="font-serif text-3xl font-semibold tracking-tight text-primary">
              DLFO
            </span>
            <span className="mt-1 block text-[11px] font-medium uppercase tracking-[0.16em] text-ink/45">
              Dynasty League Front Office
            </span>
          </span>
        </Link>

        <nav
          className="flex flex-1 flex-col gap-1 lg:mt-12"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <NavLink
              key={href}
              href={href}
              label={label}
              icon={<Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />}
            />
          ))}
        </nav>
      </div>
    </aside>
  );
}
