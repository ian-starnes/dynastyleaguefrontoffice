import { Button } from "@/components/ui/Button";

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
