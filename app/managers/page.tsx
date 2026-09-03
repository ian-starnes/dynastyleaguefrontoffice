import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { ManagerAvatar } from "@/components/managers/ManagerAvatar";
import { getManagerDirectory } from "@/lib/services/managerDirectoryService";

export default async function ManagersPage() {
  try {
    const { active, departed } = await getManagerDirectory();

    return (
      <div>
        <PageHeader
          title="Managers"
          description="Every manager in the league — who's who, and how to reach them."
        />

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((manager) => {
            const hasContact =
              manager.contact.email || manager.contact.phone || manager.contact.discord;

            return (
              <Card key={manager.ownerId} className="p-5">
                <div className="flex items-center gap-4">
                  <ManagerAvatar
                    avatarUrl={manager.avatarUrl}
                    name={manager.displayName}
                    size={56}
                  />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">
                      {manager.teamName ?? manager.displayName}
                    </p>
                    <p className="truncate text-sm text-ink/50">{manager.displayName}</p>
                  </div>
                </div>
                <p className="mt-3 text-xs uppercase tracking-wide text-ink/40">
                  Member since {manager.memberSinceSeason}
                </p>
                {hasContact ? (
                  <ul className="mt-3 space-y-1 text-sm text-ink/70">
                    {manager.contact.email ? <li>{manager.contact.email}</li> : null}
                    {manager.contact.phone ? <li>{manager.contact.phone}</li> : null}
                    {manager.contact.discord ? (
                      <li>Discord: {manager.contact.discord}</li>
                    ) : null}
                  </ul>
                ) : null}
              </Card>
            );
          })}
        </div>

        {departed.length > 0 ? (
          <div className="mt-14">
            <h2 className="font-serif text-xl text-primary">Graveyard</h2>
            <p className="mt-1 text-sm text-ink/50">
              Former managers no longer active in the league.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {departed.map((manager) => (
                <Card key={manager.name} className="p-5">
                  <div className="flex items-center gap-4">
                    <ManagerAvatar
                      avatarUrl={manager.avatarUrl ?? null}
                      name={manager.name}
                      size={56}
                      muted
                    />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink/70">
                        {manager.teamName ?? manager.name}
                      </p>
                      <p className="truncate text-sm text-ink/40">{manager.name}</p>
                    </div>
                  </div>
                  {manager.yearsActive ? (
                    <p className="mt-3 text-xs uppercase tracking-wide text-ink/40">
                      {manager.yearsActive}
                    </p>
                  ) : null}
                  {manager.note ? (
                    <p className="mt-2 text-sm text-ink/60">{manager.note}</p>
                  ) : null}
                </Card>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  } catch (error) {
    return (
      <div>
        <PageHeader
          title="Managers"
          description="Every manager in the league — who's who, and how to reach them."
        />
        <Card className="mt-8 p-8">
          <p className="text-sm text-ink/60">
            Couldn&apos;t load managers
            {error instanceof Error ? `: ${error.message}` : "."}
          </p>
        </Card>
      </div>
    );
  }
}
