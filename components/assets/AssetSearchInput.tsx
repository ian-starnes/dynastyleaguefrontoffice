"use client";

type AssetSearchInputProps = {
  value: string;
  onChange: (value: string) => void;
};

/** Controlled search input — reusable anywhere a filterable list needs one. */
export function AssetSearchInput({ value, onChange }: AssetSearchInputProps) {
  return (
    <input
      type="search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Search by player, position, team, or owner…"
      className="w-full max-w-sm rounded-lg border border-black/10 bg-white px-4 py-2.5 text-sm text-ink placeholder:text-ink/40 focus:border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary/10"
    />
  );
}
