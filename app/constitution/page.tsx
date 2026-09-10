import Link from "next/link";
import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";

const GOOGLE_DOC_URL =
  "https://docs.google.com/document/d/1-EZ4QI7h0x1R1bJi0Thzsy9wYrfvVq--XHYkLiazVbA/edit?usp=sharing";

function ArticleHeading({ number, title }: { number: string; title: string }) {
  return (
    <h2 className="mt-10 font-serif text-xl text-primary">
      Article {number} — {title}
    </h2>
  );
}

function SubHeading({ children }: { children: string }) {
  return <h3 className="mt-4 font-medium text-ink">{children}</h3>;
}

function P({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-ink/70">{children}</p>;
}

function UL({ items }: { items: ReactNode[] }) {
  return (
    <ul className="mt-2 list-disc space-y-1 pl-5 text-ink/70">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

function Formula({ children }: { children: string }) {
  return (
    <p className="mt-2 rounded-lg bg-primary/5 px-3 py-2 font-mono text-sm text-primary">
      {children}
    </p>
  );
}

// Static document content — see the linked Google Doc for the source of
// truth. Per Article I, this cannot change mid-season anyway, so a
// rendered snapshot (rather than a live fetch of an external, ACL'd
// Google Doc) is the right tradeoff: no auth/availability dependency for
// a document that's only ever amended in the offseason.
export default function ConstitutionPage() {
  return (
    <div>
      <PageHeader
        title="Constitution"
        description="The Dynasty League's governing document — rules, procedures, and philosophy."
      />
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink/40">
        <span>Created 9.2.2020 · Amended 8.3.2026</span>
        <Link
          href={GOOGLE_DOC_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
        >
          View source on Google Docs <ExternalLink className="h-3 w-3" strokeWidth={2} />
        </Link>
      </div>

      <Card className="mt-6 p-6">
        <p className="font-serif text-lg text-ink">
          The Dynasty League exists to create the most competitive, engaging, and
          sustainable fantasy football experience possible.
        </p>
        <p className="mt-3 text-sm text-ink/50">The League is built upon four guiding principles:</p>
        <UL
          items={[
            "Reward skill over luck.",
            "Encourage long-term roster construction.",
            "Promote active participation and strategic trading.",
            "Preserve competitive integrity.",
          ]}
        />
        <p className="mt-3 text-sm text-ink/50">
          This Constitution serves as the governing document of the Dynasty League and
          establishes the rules, procedures, and philosophy by which the League operates.
        </p>
      </Card>

      <ArticleHeading number="I" title="League Governance" />
      <P>
        All roster requirements, scoring settings, scheduling, playoff format, and league
        configuration contained within Sleeper are considered official League rules and
        are incorporated into this Constitution by reference.
      </P>
      <P>
        No changes to league structure, scoring, roster settings, or governance shall
        take effect during an active season.
      </P>
      <P>Any proposed rule change must:</P>
      <UL
        items={[
          "Be submitted to the Commissioners for review.",
          "Receive Commissioner approval and then be ratified by a simple majority of League owners.",
        ]}
      />
      <P>
        Unless otherwise specified, approved rule changes become effective beginning with
        the next active season.
      </P>
      <P>
        Commissioners reserve the authority to resolve unforeseen situations not
        specifically addressed within this Constitution. Any ruling shall be made in the
        best interest of competitive fairness and the long-term health &amp; integrity of
        the League.
      </P>

      <ArticleHeading number="II" title="League Philosophy" />
      <P>
        The Dynasty League is designed to reward exceptional fantasy management over
        sustained periods of time.
      </P>
      <P>Success should come from:</P>
      <UL
        items={[
          "Superior player evaluation",
          "Strategic auction budgeting",
          "Intelligent keeper decisions",
          "Active waiver management",
          "Effective trading",
          "Weekly lineup optimization",
        ]}
      />
      <P>
        League rules are intentionally designed to reduce randomness while maximizing
        owner skill.
      </P>

      <ArticleHeading number="III" title="Keeper System" />
      <P>The keeper system is the foundation of the Dynasty League.</P>
      <P>
        Owners must retain a minimum of two (2) players each offseason and may retain as
        many additional players as desired, provided they remain compliant with the
        annual auction budget.
      </P>

      <SubHeading>Section 1 — Keeper Salaries</SubHeading>
      <P>Keeper salaries increase by $5 each League Year.</P>
      <Formula>Keeper Salary = Previous Season Salary + $5</Formula>

      <SubHeading>Section 2 — Undrafted Free Agents</SubHeading>
      <P>
        Only players who were not purchased during the annual auction are assigned an
        acquisition value of $0.
      </P>
      <P>
        If retained as keepers, those players shall enter the following League Year with
        a keeper salary of $5.
      </P>
      <P>
        Players drafted at auction retain their original salary lineage regardless of
        whether they are later dropped, claimed on waivers, or traded.
      </P>
      <P>
        This policy rewards exceptional waiver acquisitions while maintaining consistency
        within the League&apos;s keeper economy.
      </P>

      <SubHeading>Section 3 — Keeper Term Limit</SubHeading>
      <P>
        A player may remain with the same franchise for a maximum of five (5) consecutive
        League Seasons, consisting of the acquisition season plus four (4) consecutive
        keeper seasons.
      </P>
      <P>
        Keeper eligibility is tied to consecutive seasons with the same franchise. If a
        player is traded, the consecutive keeper term resets for the acquiring franchise.
      </P>
      <P>
        Following a player&apos;s fourth consecutive keeper season with the same
        franchise, the player must either be returned to the annual auction or traded
        prior to the next Keeper Declaration Deadline. A player may not be retained by
        the same franchise for a sixth consecutive League Season.
      </P>
      <P>
        This provision preserves the long-term value of identifying and developing
        talent, encourages an active trade market, and ensures that elite players
        periodically return to the annual auction.
      </P>

      <SubHeading>Section 4 — Keeper Declaration</SubHeading>
      <P>
        Prior to each League Year, the Commissioner shall distribute official keeper
        salaries for every eligible player.
      </P>
      <P>
        A Keeper Declaration Deadline shall be established no more than two weeks prior
        (14 days) before the annual auction.
      </P>
      <P>
        Following the declaration deadline, keeper selections become final and Sleeper
        rosters &amp; draft board shall be updated accordingly.
      </P>

      <ArticleHeading number="IV" title="Annual Auction Draft" />
      <P>
        The annual auction is the League&apos;s primary player acquisition event. Every
        player not retained as a keeper shall enter the auction. Managers are responsible
        for constructing a complete legal roster while remaining within the established
        auction budget. Auction procedures shall follow Sleeper settings unless announced
        prior to the beginning of the auction.
      </P>

      <ArticleHeading number="V" title="Trading" />
      <P>
        Trading is encouraged as a core component of League strategy. The trading window
        opens immediately following the conclusion of each League Championship and
        remains open throughout the offseason. The annual in-season trade deadline occurs
        following Week 12 of the regular season.
      </P>
      <P>Owners may trade:</P>
      <UL
        items={[
          "Eligible players",
          "Future draft assets for the next two active seasons",
          "Any other assets explicitly permitted within Sleeper (i.e. FAAB)",
        ]}
      />

      <SubHeading>Auction Budget Credits</SubHeading>
      <P>
        The Dynasty League is fundamentally an auction-based league. Because the Sleeper
        platform does not currently support the trading of future auction budgets, the
        League utilizes future snake draft selections solely as representations of
        Future Auction Budget Credits.
      </P>
      <P>
        These selections are administrative placeholders only and do not represent
        traditional draft picks. Their sole purpose is to facilitate the trading of
        future auction spending power.
      </P>
      <P>
        Each future snake draft selection is assigned a fixed Auction Budget Credit value
        as set forth in Appendix A of this Constitution. The aggregate value of all
        Future Auction Budget Credits assigned to a League Year shall equal the
        League&apos;s standard auction budget of $200. The Commissioner shall maintain
        Appendix A and may update its conversion schedule upon offseason data
        calibration.
      </P>

      <SubHeading>Restricted Trading Window</SubHeading>
      <P>
        Trades completed during Weeks 11 and 12 require a $10 fee from each participating
        owner, paid directly into the Dynasty Pot.
      </P>

      <SubHeading>Trade Review Policy</SubHeading>
      <P>
        Trades shall not be reviewed or overturned solely because they appear uneven in
        player value. Commissioner intervention is reserved exclusively for transactions
        involving collusion, bad faith, or actions deemed materially detrimental to the
        competitive integrity of the League. Commissioner determinations regarding
        collusion or League integrity are final unless overturned by a two-thirds vote of
        League ownership.
      </P>

      <ArticleHeading number="VI" title="Dynasty Pot" />
      <P>
        The Dynasty Pot exists to recognize sustained excellence across multiple seasons.
        Each League Year, $150 shall be allocated to the Dynasty Pot.
      </P>
      <P>
        The first owner to win three (3) League Championships shall receive the entire
        Dynasty Pot. Following payout, the Dynasty Pot resets and begins accumulating
        again. Owners remain eligible to win future Dynasty Pots upon reaching
        championship milestones in multiples of three (6, 9, 12, etc.).
      </P>

      <ArticleHeading number="VII" title="League Prize Structure" />
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink/40">Annual Entry Fee</p>
          <p className="mt-1 font-serif text-lg text-ink">$150 / owner</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-ink/40">Annual Prize Pool</p>
          <p className="mt-1 font-serif text-lg text-ink">$1,500</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-ink/40">Season Champion</p>
          <p className="mt-1 font-serif text-lg text-gold">$800</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-ink/40">Runner-Up</p>
          <p className="mt-1 font-serif text-lg text-silver">$400</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-ink/40">Third Place</p>
          <p className="mt-1 font-serif text-lg text-bronze">$150</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-ink/40">Dynasty Pot Contribution</p>
          <p className="mt-1 font-serif text-lg text-ink">$150</p>
        </div>
      </div>

      <ArticleHeading number="VIII" title="Competitive Balance Auction Budget" />
      <P>
        To reward sustained regular-season success while preserving competitive balance,
        the Dynasty League utilizes a graduated auction budget system.
      </P>
      <P>
        Each League Year, every franchise receives an auction budget based on its final
        order of finish from the previous season.
      </P>
      <P>The auction budgets are outlined in Appendix B.</P>

      <ArticleHeading number="IX" title="Weekly Incentives" />
      <P>
        To encourage full-season competition and discourage intentional losing, the
        League employs weekly performance incentives.
      </P>
      <P>During Weeks 1 through 14:</P>
      <UL
        items={[
          "The highest-scoring team each week shall receive $20 from the lowest-scoring team.",
          "Payment must be completed prior to kickoff of the following Thursday Night Football game.",
          "Failure to pay shall result in the owner's lineup being locked until payment has been received.",
        ]}
      />
      <P>These incentives apply regardless of League standings.</P>

      <ArticleHeading number="X" title="Competitive Integrity" />
      <P>Every owner is expected to field a complete and competitive lineup each week.</P>
      <P>Intentional tanking through lineup manipulation is prohibited.</P>
      <P>Violations include:</P>
      <UL
        items={[
          "Leaving an open starting lineup position.",
          "Starting a player on Bye.",
          "Starting a player designated Out or on Injured Reserve when a healthy alternative exists on the active roster.",
        ]}
      />
      <P>Each violation shall result in a $10 fine paid into the Dynasty Pot.</P>
      <P>Commissioners may waive penalties in extraordinary circumstances communicated in advance.</P>
      <P>
        Once a team has been mathematically eliminated from playoff contention, that
        team&apos;s roster shall be locked for the remainder of the League Year.
      </P>
      <P>
        Eliminated teams may continue to submit legal starting lineups each week but may
        not add, drop, or trade players.
      </P>

      <ArticleHeading number="XI" title="Sportsmanship" />
      <P>
        The Dynasty League is intended to be highly competitive while maintaining mutual
        respect among its members.
      </P>
      <P>Owners are expected to:</P>
      <UL
        items={[
          "Compete to win every week.",
          "Act in good faith.",
          "Respond to trade offers within a reasonable timeframe.",
          "Fulfill all League financial obligations promptly.",
          "Treat fellow owners with respect.",
        ]}
      />
      <P>Collusion of any kind is strictly prohibited.</P>

      <ArticleHeading number="XII" title="Constitutional Amendments" />
      <p className="mt-1 text-[11px] italic text-ink/30">
        Labeled &ldquo;Article XI&rdquo; a second time in the source document — renumbered
        here for clarity.
      </p>
      <P>
        This Constitution may be amended only through the governance process established
        in Article I.
      </P>

      <Card className="mt-10 p-6">
        <p className="font-serif italic leading-relaxed text-ink/80">
          The Dynasty League is more than a fantasy football league. It is a long-term
          competition built on strategy, commitment, rivalry, and tradition. Championships
          are earned through sustained excellence, thoughtful management, and competitive
          integrity. Every rule contained within this Constitution exists to preserve
          those principles for future seasons and to ensure the Dynasty League remains a
          competition worthy of its owners.
        </p>
      </Card>

      <h2 className="mt-10 font-serif text-xl text-primary">
        Appendix A — Future Auction Budget Credit Conversion
      </h2>
      <p className="mt-1 text-sm text-ink/50">
        The fixed Auction Budget Credit value of each future snake draft selection,
        referenced in Article V.
      </p>
      <Card className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-black/10 text-xs font-medium uppercase tracking-wide text-ink/50">
              <th className="px-5 py-3">Sleeper Round</th>
              <th className="px-5 py-3">Auction Credit</th>
              <th className="px-5 py-3">Tier</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {[
              [1, "$50", "Elite"],
              [2, "$30", "Elite"],
              [3, "$20", "Elite"],
              [4, "$18", "Starter"],
              [5, "$17", "Starter"],
              [6, "$15", "Starter"],
              [7, "$13", "Starter"],
              [8, "$11", "Starter"],
              [9, "$8", "Depth"],
              [10, "$6", "Depth"],
              [11, "$4", "Depth"],
              [12, "$3", "Depth"],
              [13, "$2", "Depth"],
              [14, "$2", "Depth"],
              [15, "$1", "Depth"],
            ].map(([round, credit, tier]) => (
              <tr key={round}>
                <td className="px-5 py-2.5 text-ink">{round}</td>
                <td className="px-5 py-2.5 text-ink/70">{credit}</td>
                <td className="px-5 py-2.5 text-ink/70">{tier}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <h2 className="mt-10 font-serif text-xl text-primary">
        Appendix B — Competitive Balance Auction Budget Adjustment
      </h2>
      <p className="mt-1 text-sm text-ink/50">
        The auction budget adjustment applied per Article VIII, based on the previous
        season&apos;s final order of finish.
      </p>
      <Card className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[320px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-black/10 text-xs font-medium uppercase tracking-wide text-ink/50">
              <th className="px-5 py-3">Place</th>
              <th className="px-5 py-3">Budget Adjustment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {[
              [1, "-$6"],
              [2, "-$3"],
              [3, "-$1"],
              [4, "—"],
              [5, "—"],
              [6, "—"],
              [7, "—"],
              [8, "+$1"],
              [9, "+$3"],
              [10, "+$6"],
            ].map(([place, adjustment]) => (
              <tr key={place}>
                <td className="px-5 py-2.5 text-ink">{place}</td>
                <td className="px-5 py-2.5 text-ink/70">{adjustment}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <h2 className="mt-10 font-serif text-xl text-primary">Appendix C — League Honors</h2>
      <P>
        For the full season-by-season record — runner-up, third place, regular-season
        champion, and highest-scoring team — see{" "}
        <Link href="/history" className="font-medium text-primary hover:underline">
          History → Wall of Champions
        </Link>
        , sourced live from Sleeper. Champions, for reference:
      </P>
      <Card className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[320px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-black/10 text-xs font-medium uppercase tracking-wide text-ink/50">
              <th className="px-5 py-3">Season</th>
              <th className="px-5 py-3">Champion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {[
              [2020, "Ian Starnes"],
              [2021, "Stew Allen"],
              [2022, "Jon Hediger"],
              [2023, "Stew Allen (2x)"],
              [2024, "Andrew Wittmers"],
              [2025, "Chris Ramirez"],
            ].map(([season, champion]) => (
              <tr key={season}>
                <td className="px-5 py-2.5 text-ink">{season}</td>
                <td className="px-5 py-2.5 font-medium text-gold">{champion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <h2 className="mt-10 font-serif text-xl text-primary">
        Appendix D — Annual League Calendar
      </h2>
      <Card className="mt-4 divide-y divide-black/5">
        {[
          ["Offseason", "Strategic review"],
          ["Early August", "Keeper costs and auction budgets distributed"],
          ["One week prior to auction", "Keeper declaration date"],
          ["Late Aug / early Sept", "Auction draft"],
          ["NFL Week 1", "Season starts"],
          ["NFL Week 11", "Restricted trading window opens"],
          ["NFL Week 12", "Trade deadline week (closes at end of MNF)"],
          ["NFL Weeks 13–17", "Playoffs"],
        ].map(([period, event]) => (
          <div
            key={period}
            className="flex flex-col gap-0.5 p-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
          >
            <span className="font-medium text-ink">{period}</span>
            <span className="text-sm text-ink/60 sm:text-right">{event}</span>
          </div>
        ))}
      </Card>

      <h2 className="mt-10 font-serif text-xl text-primary">Punishments for Lottery Teams</h2>
      <P>
        Owners who finish 7th through 10th select from the punishment categories below —
        a Dynasty League tradition distinct from the Constitution&apos;s formal rules
        above.
      </P>

      <SubHeading>Process</SubHeading>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-ink/70">
        <li>
          The 7th place owner selects TWO punishments from DIFFERENT categories that they
          are willing to do.
        </li>
        <li>Playoff teams vote for which punishment of the two they want the owner to complete.</li>
        <li>
          Those previously selected punishments are removed from the list, and the
          process continues for 8th, 9th &amp; then 10th place.
        </li>
      </ol>
      <p className="mt-3 text-sm text-ink/50">
        Important note: if the owner doesn&apos;t complete their assigned punishment by
        draft start time, the buyout fees will be imposed.
      </p>

      <SubHeading>Buyout</SubHeading>
      <P>Owners can buy their way out of the punishment process by:</P>
      <UL
        items={[
          "Extra $150 to the Dynasty Pot (double entry fee for the following season)",
          "Losing $45 of Auction budget ($5 allocated to each other manager)",
          "FAAB budget reduced to $50 to start next season",
        ]}
      />

      <SubHeading>Punishment Category Buckets</SubHeading>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <p className="font-medium text-ink">Limited to Fantasy League Only</p>
          <UL
            items={[
              "Rebranding — league chooses the team name for the following year. Can change if in the playoffs.",
              "Ten Tebow — must draft Tim Tebow for $10 in the auction draft.",
              "Ochocinco — lose $8 of FAAB and $5 from auction budget for next year + must roster Chad Johnson through Week 1 of the season.",
              "On the Clock — must finish a six-pack of beer during the draft, but can only drink when on the clock.",
              "Oh Captain, My Captain — after the draft and before the season starts, name one roster player as your “Captain.” The Captain can't be dropped or traded all year and must be kept the following season. After that draft, they can be released or traded.",
              "Belichick's Wet Dream — must draft an entire team filled with white guys.",
            ]}
          />
        </Card>
        <Card className="p-5">
          <p className="font-medium text-ink">Personal Torture / Physical Harm</p>
          <UL
            items={[
              "Waffle House Challenge — spend 24 hours straight at a Waffle House, minus an hour for each waffle consumed. IHOP works too, sub pancakes in.",
              "Beer Mile — one beer every lap, must be on video.",
              "Glizzy Game — go to a baseball game and eat one hot dog every inning.",
              "Combine — video yourself doing NFL Combine drills and post it to social media acting like a long-shot prospect.",
              "Shotgun Start — shotgun a beer before work on opening day of the season (TNF kickoff).",
              "3/6/9/12 — beers drank, times masturbated, donuts eaten, miles ran in a 24-hour period (you pick the number for each).",
              "Shitty Year — draft next year in a porta potty or public restroom, must be on video call.",
              "One Chip Challenge — before the draft starts.",
            ]}
          />
        </Card>
        <Card className="p-5">
          <p className="font-medium text-ink">Public Humiliation</p>
          <UL
            items={[
              "A Star is Born — three songs of karaoke at the local karaoke bar; the group picks the songs.",
              "Someone Still Loves Me — take a blow-up doll or giant stuffed animal on a date to a restaurant and tell the staff it's their birthday.",
              "Open Mic Night — stand-up at a local comedy club.",
              "Roast — at live draft weekend, all other present owners roast the loser.",
              "Cameo — the league picks the celebrity and the script for a roast; loser pays for it, up to $100.",
              "Shame! — make a sign and stand at a busy intersection with an “I'm Bad at Fantasy Football” sign for 30 minutes.",
            ]}
          />
        </Card>
        <Card className="p-5">
          <p className="font-medium text-ink">Personal Humiliation</p>
          <UL
            items={[
              "I Finished in the Bottom — buy cucumbers, condoms, and lube from the grocery store. No self-checkout.",
              "Amber Alert — attend a Kidz Bop concert or Disney on Ice-type show by yourself.",
              "Body Issue — recreate an image from an ESPN Body Issue shoot.",
              "Pinup Doll — create a sexy calendar and send it to all other owners.",
              "Rain Man — livestream yourself counting to 10,000.",
              "90s Kid — get blonde frosted tips.",
              "Trick or Treat — go out in summer in costume and get candy from 10 houses.",
            ]}
          />
        </Card>
      </div>
    </div>
  );
}
