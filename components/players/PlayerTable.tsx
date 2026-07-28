import type { LeaguePlayer } from "@/lib/sleeper";

/** Purely presentational — renders whatever rows it's given, nothing more. */
export function PlayerTable({ players }: { players: LeaguePlayer[] }) {
  return (
    <div className="max-h-[65vh] overflow-y-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="sticky top-0 z-10 border-b border-black/10 bg-white text-xs font-medium uppercase tracking-wide text-ink/50">
            <th className="px-5 py-3">Player</th>
            <th className="px-5 py-3">Position</th>
            <th className="px-5 py-3">NFL Team</th>
            <th className="px-5 py-3">Current Owner</th>
          </tr>
        </thead>
        <tbody>
          {players.map(({ nflPlayer, currentOwnerName }) => (
            <tr
              key={nflPlayer.id}
              className="border-b border-black/5 last:border-0 hover:bg-black/[0.02]"
            >
              <td className="px-5 py-3 font-medium text-ink">
                {nflPlayer.fullName}
              </td>
              <td className="px-5 py-3 text-ink/70">{nflPlayer.position}</td>
              <td className="px-5 py-3 text-ink/70">{nflPlayer.nflTeam}</td>
              <td className="px-5 py-3 text-ink/70">
                {currentOwnerName ?? (
                  <span className="text-ink/30">Free agent</span>
                )}
              </td>
            </tr>
          ))}

          {players.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-5 py-10 text-center text-ink/40">
                No players match your search.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
