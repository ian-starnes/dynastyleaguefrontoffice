import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";

/**
 * Top-level page frame: fixed sidebar on the left, scrollable content on the
 * right. Every route is rendered as `children` here via app/layout.tsx, so
 * the nav and chrome never re-mount between page transitions.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-ink lg:flex">
      <Sidebar />
      <main className="min-w-0 flex-1 lg:pl-72">
        <div className="mx-auto max-w-5xl px-6 py-10 sm:px-10 lg:px-16 lg:py-16">
          {children}
        </div>
      </main>
    </div>
  );
}
