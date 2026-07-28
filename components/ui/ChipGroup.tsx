"use client";

type Chip<T extends string> = { id: T; label: string };

type ChipGroupProps<T extends string> = {
  chips: Chip<T>[];
  activeId: T;
  onChange: (id: T) => void;
};

/** Reusable pill-style single-select filter, generic over the id type. */
export function ChipGroup<T extends string>({
  chips,
  activeId,
  onChange,
}: ChipGroupProps<T>) {
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => {
        const isActive = chip.id === activeId;

        return (
          <button
            key={chip.id}
            type="button"
            onClick={() => onChange(chip.id)}
            aria-pressed={isActive}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
              isActive
                ? "bg-primary text-background"
                : "border border-black/10 text-ink/60 hover:bg-black/[0.03] hover:text-ink"
            }`}
          >
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}
