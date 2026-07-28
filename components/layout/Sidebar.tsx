import Link from "next/link";
import { NAV_ITEMS } from "./nav-items";
import { NavLink } from "./NavLink";

/**
 * Left-hand navigation column. Fixed on large screens so it stays put while
 * the main content scrolls; stacks as a top bar on small screens since the
 * shell is desktop-first but still needs to hold together on mobile.
 */
export function Sidebar() {
  return (
    <aside className="border-b border-black/5 lg:fixed lg:inset-y-0 lg:left-0 lg:w-72 lg:border-b-0 lg:border-r">
      <div className="flex flex-col px-6 py-6 lg:h-full lg:px-8 lg:py-10">
        <Link href="/" className="flex items-center gap-3">
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

        <nav className="mt-8 flex flex-1 flex-col gap-1 lg:mt-12">
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
