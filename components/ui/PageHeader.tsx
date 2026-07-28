/**
 * Consistent title block for interior pages (League, Teams, Players, etc.)
 * so every section of the shell reads as part of the same system.
 */
export function PageHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div>
      <h1 className="font-serif text-3xl text-primary">{title}</h1>
      {description ? (
        <p className="mt-2 text-ink/60">{description}</p>
      ) : null}
    </div>
  );
}
