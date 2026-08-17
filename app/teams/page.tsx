import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { formatDollarValue } from "@/lib/format";
import { FranchiseValueService } from "@/lib/services/franchiseValueService";

export default async function TeamsPage() {
  try {
    const valuations = await new FranchiseValueService().getFranchiseValuations();

    return (
      <div>
        <PageHeader
          title="Teams"
          description="Every franchise in the league — roster, contracts, and future capital."
        />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {valuations.map((team) => (
            <Link key={team.ownerId} href={`/teams/${team.ownerId}`}>
              <Card className="p-5 transition hover:border-gold/40">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-ink">{team.ownerName}</p>
                  <span className="text-xs text-ink/40">#{team.rank}</span>
                </div>
                <p className="mt-2 font-serif text-2xl text-gold">
                  {formatDollarValue(team.franchiseValue)}
                </p>
                <p className="mt-1 text-xs text-ink/50">
                  Roster {formatDollarValue(team.rosterAssetValue)} · Picks{" "}
                  {formatDollarValue(team.futurePickValue)}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    );
  } catch (error) {
    return (
      <div>
        <PageHeader
          title="Teams"
          description="Every franchise in the league — roster, contracts, and future capital."
        />
        <Card className="mt-8 p-8">
          <p className="text-sm text-ink/60">
            Couldn&apos;t load teams
            {error instanceof Error ? `: ${error.message}` : "."}
          </p>
        </Card>
      </div>
    );
  }
}
