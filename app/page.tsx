import { Button } from "@/components/ui/Button";

// Pillars the platform will eventually surface real data for. Labels only —
// no football logic or data lives in the shell yet.
const PLATFORM_PILLARS = [
  "Franchise Value",
  "Keeper Surplus",
  "Auction Budget",
  "Contract Timeline",
  "League Intelligence",
];

/**
 * The "Front Office" landing view — pure marketing/orientation content, no
 * football functionality. Vertically centered hero within the shell's main
 * content column.
 */
export default function HomePage() {
  return (
    <section className="flex min-h-[70vh] flex-col justify-center">
      <p className="font-serif text-sm tracking-[0.3em] text-gold">DLFO</p>

      <h1 className="mt-4 max-w-2xl font-serif text-5xl leading-[1.05] text-primary sm:text-6xl">
        Run Your Franchise.
      </h1>

      <p className="mt-6 max-w-xl text-lg italic text-ink/60">
        &ldquo;The operating system for keeper and dynasty fantasy
        football.&rdquo;
      </p>

      <ul className="mt-10 flex max-w-2xl flex-wrap items-center gap-x-4 gap-y-2 border-t border-gold/30 pt-6">
        {PLATFORM_PILLARS.map((pillar, index) => (
          <li key={pillar} className="flex items-center gap-4">
            {index > 0 ? (
              <span aria-hidden className="h-1 w-1 rounded-full bg-gold" />
            ) : null}
            <span className="text-xs font-medium uppercase tracking-[0.12em] text-primary/70">
              {pillar}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-10 flex flex-wrap items-center gap-4">
        <Button variant="primary" href="/league">
          Enter Front Office
        </Button>
        <Button variant="secondary" href="/settings">
          Learn More
        </Button>
      </div>
    </section>
  );
}
