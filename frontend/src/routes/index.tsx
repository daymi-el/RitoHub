import type { LeagueEntryDTO } from "@zqz979/league-api-wrapper";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import {
  ArrowDownAZ,
  ArrowUpDown,
  Filter,
  Loader2,
  Plus,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { AccountRow } from "@/components/blocks/account-card";
import { AddAccountDialog } from "@/components/blocks/add-account-dialog";
import { AppPageHeader } from "@/components/blocks/app-page-header";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  compareLeagueEntries,
  getSoloQueueEntry,
} from "@/lib/league-rank";
import { fetchSummonerProfile } from "@/lib/riot-api";
import { getPlatformLabel, getRankEmblemPath } from "@/lib/riot";
import {
  type Account,
  GAME_ACCENT_COLORS,
  GAME_DESCRIPTIONS,
  RIOT_GAME_LABELS,
  type RiotGame,
} from "@/lib/types";
import { useAccounts } from "@/providers/accounts-context";
import { useGameSelection } from "@/providers/game-selection-context";

export const Route = createFileRoute("/")({
  component: Home,
});

type SortMode = "rank" | "name-asc" | "name-desc";
type RankFilter = "all" | "ranked" | "unranked";

const SORT_OPTIONS: { value: SortMode; label: string; icon: React.ReactNode }[] = [
  { value: "rank", label: "Rank", icon: <TrendingUp className="size-3.5" /> },
  { value: "name-asc", label: "Name A\u2013Z", icon: <ArrowDownAZ className="size-3.5" /> },
  { value: "name-desc", label: "Name Z\u2013A", icon: <TrendingDown className="size-3.5" /> },
];

function Home() {
  const { accountsList, isLoaded } = useAccounts();
  const { selectedGame } = useGameSelection();

  const selectedAccounts = useMemo(
    () => accountsList.filter((a) => a.games.includes(selectedGame)),
    [accountsList, selectedGame],
  );

  return (
    <div className="min-h-screen flex flex-col">
      <AppPageHeader
        title={RIOT_GAME_LABELS[selectedGame]}
        trailing={
          <AddAccountDialog
            trigger={
              <button
                type="button"
                className="group inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-card/80 px-3 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur-sm transition-all duration-200 hover:border-[--accent]/40 hover:text-[--accent] hover:bg-[--accent]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                style={{ "--accent": GAME_ACCENT_COLORS[selectedGame] } as React.CSSProperties}
              >
                <Plus className="size-3.5 transition-transform duration-200 group-hover:rotate-90" />
                Add
              </button>
            }
          />
        }
        accentColor={GAME_ACCENT_COLORS[selectedGame]}
      />

      <main className="flex-1 px-4 py-6 md:px-6 md:py-8">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
          {!isLoaded ? (
            <LoadingState />
          ) : (
            <div key={selectedGame} className="animate-game-view-in">
              {selectedGame === "league-of-legends" ? (
                <LeagueOfLegendsView accounts={selectedAccounts} />
              ) : (
                <TaggedGameView
                  game={selectedGame}
                  accounts={selectedAccounts}
                  description={GAME_DESCRIPTIONS[selectedGame]}
                />
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function LoadingState() {
  return (
    <section className="space-y-6 animate-in fade-in duration-500">
      <div className="space-y-2">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-4 w-80" />
      </div>
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex items-center gap-4 rounded-xl border p-4"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="skeleton h-12 w-12 rounded-lg" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-4 w-40" />
              <div className="skeleton h-3 w-24" />
            </div>
            <div className="skeleton h-8 w-20 rounded-md" />
          </div>
        ))}
      </div>
    </section>
  );
}

function groupAccountsByPlatform(accounts: Account[]) {
  const groups = new Map<string, Account[]>();
  for (const account of accounts) {
    const key = account.platform;
    const existing = groups.get(key);
    if (existing) {
      existing.push(account);
    } else {
      groups.set(key, [account]);
    }
  }
  return groups;
}

/* ------------------------------------------------------------------ */
/*  Sorting & Filtering Toolbar                                       */
/* ------------------------------------------------------------------ */

interface AccountToolbarProps {
  sortMode: SortMode;
  onSortChange: (mode: SortMode) => void;
  rankFilter: RankFilter;
  onRankFilterChange: (filter: RankFilter) => void;
  regionFilter: string;
  onRegionFilterChange: (region: string) => void;
  regions: string[];
  isRefreshingAll: boolean;
  onRefreshAll: () => void;
}

function AccountToolbar({
  sortMode,
  onSortChange,
  rankFilter,
  onRankFilterChange,
  regionFilter,
  onRegionFilterChange,
  regions,
  isRefreshingAll,
  onRefreshAll,
}: AccountToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Sort */}
      <div className="flex items-center gap-1.5">
        <ArrowUpDown className="size-3.5 text-muted-foreground" />
        <Select value={sortMode} onValueChange={(v) => onSortChange(v as SortMode)}>
          <SelectTrigger size="sm" className="h-8 text-xs gap-1.5 min-w-[7rem]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                <span className="flex items-center gap-2">
                  {opt.icon}
                  {opt.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Rank filter */}
      <div className="flex items-center gap-1.5">
        <Filter className="size-3.5 text-muted-foreground" />
        <Select value={rankFilter} onValueChange={(v) => onRankFilterChange(v as RankFilter)}>
          <SelectTrigger size="sm" className="h-8 text-xs gap-1.5 min-w-[7rem]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ranks</SelectItem>
            <SelectItem value="ranked">Ranked only</SelectItem>
            <SelectItem value="unranked">Unranked only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Region filter */}
      {regions.length > 1 && (
        <Select value={regionFilter} onValueChange={onRegionFilterChange}>
          <SelectTrigger size="sm" className="h-8 text-xs gap-1.5 min-w-[8rem]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All regions</SelectItem>
            {regions.map((r) => (
              <SelectItem key={r} value={r}>
                {getPlatformLabel(r as Account["platform"])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Refresh all */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={onRefreshAll}
            disabled={isRefreshingAll}
          >
            {isRefreshingAll ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            <span className="hidden sm:inline">
              {isRefreshingAll ? "Refreshing\u2026" : "Refresh all"}
            </span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <span>{isRefreshingAll ? "Refreshing all accounts\u2026" : "Refresh all accounts"}</span>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared refresh-all logic                                          */
/* ------------------------------------------------------------------ */

function useRefreshAllAccounts(accounts: Account[]) {
  const { updateAccount } = useAccounts();
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);

  const handleRefreshAll = useCallback(async () => {
    if (isRefreshingAll) return;
    setIsRefreshingAll(true);
    try {
      const results = await Promise.allSettled(
        accounts.map(async (account) => {
          const { riotData, leagueData } = await fetchSummonerProfile(
            account.riotData.puuid,
            account.platform,
            {
              gameName: account.gameName,
              tagLine: account.tagLine,
            },
          );
          updateAccount(account.userName, {
            gameName: riotData.gameName ?? account.gameName,
            tagLine: riotData.tagLine ?? account.tagLine,
            riotData,
            leagueData,
          });
        }),
      );
      const failures = results.filter((r) => r.status === "rejected");
      if (failures.length > 0) {
        console.error(`Failed to refresh ${failures.length} account(s)`, failures);
      }
    } finally {
      setIsRefreshingAll(false);
    }
  }, [accounts, isRefreshingAll, updateAccount]);

  return { isRefreshingAll, handleRefreshAll };
}

/* ------------------------------------------------------------------ */
/*  League of Legends view                                            */
/* ------------------------------------------------------------------ */

function LeagueOfLegendsView({ accounts }: { accounts: Account[] }) {
  const [sortMode, setSortMode] = useState<SortMode>("rank");
  const [rankFilter, setRankFilter] = useState<RankFilter>("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const { isRefreshingAll, handleRefreshAll } = useRefreshAllAccounts(accounts);

  const regions = useMemo(() => {
    const set = new Set(accounts.map((a) => a.platform));
    return [...set];
  }, [accounts]);

  const filteredAndSorted = useMemo(() => {
    let result = [...accounts];

    if (rankFilter === "ranked") {
      result = result.filter((a) => getSoloQueueStats(a));
    } else if (rankFilter === "unranked") {
      result = result.filter((a) => !getSoloQueueStats(a));
    }

    if (regionFilter !== "all") {
      result = result.filter((a) => a.platform === regionFilter);
    }

    switch (sortMode) {
      case "rank":
        result.sort(compareLeagueAccounts);
        break;
      case "name-asc":
        result.sort((a, b) => a.gameName.localeCompare(b.gameName));
        break;
      case "name-desc":
        result.sort((a, b) => b.gameName.localeCompare(a.gameName));
        break;
    }

    return result;
  }, [accounts, sortMode, rankFilter, regionFilter]);

  if (accounts.length === 0) {
    return (
      <HubEmptyState
        title="No League Accounts Yet"
        description="Get started by adding your first League of Legends account using the button above."
      />
    );
  }

  const platformGroups = groupAccountsByPlatform(filteredAndSorted);
  const showSections = regionFilter === "all" && platformGroups.size > 1;

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">
          League of Legends
        </h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Manage, sort, and filter your saved accounts.
        </p>
      </div>

      <AccountToolbar
        sortMode={sortMode}
        onSortChange={setSortMode}
        rankFilter={rankFilter}
        onRankFilterChange={setRankFilter}
        regionFilter={regionFilter}
        onRegionFilterChange={setRegionFilter}
        regions={regions}
        isRefreshingAll={isRefreshingAll}
        onRefreshAll={handleRefreshAll}
      />

      {filteredAndSorted.length === 0 ? (
        <div className="flex min-h-[10vh] items-center justify-center rounded-xl border border-dashed border-border/50 px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            No accounts match the current filters.
          </p>
        </div>
      ) : showSections ? (
        <div className="flex flex-col gap-6">
          {[...platformGroups.entries()].map(([platform, groupAccounts]) => (
            <div key={platform} className="space-y-2">
              <h3 className="flex items-center gap-3 text-sm font-medium text-muted-foreground/80 tracking-wide uppercase before:h-px before:w-6 before:bg-border">
                {getPlatformLabel(platform as Account["platform"])}
              </h3>
              <div className="flex flex-col gap-2">
                {groupAccounts.map((account, i) => (
                  <AccountRow key={account.userName} account={account} index={i} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filteredAndSorted.map((account, i) => (
            <AccountRow key={account.userName} account={account} index={i} />
          ))}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Tagged game view (Valorant, TFT, etc.)                            */
/* ------------------------------------------------------------------ */

function TaggedGameView({
  game,
  accounts,
  description,
}: {
  game: RiotGame;
  accounts: Account[];
  description: string;
}) {
  const [sortMode, setSortMode] = useState<SortMode>("name-asc");
  const [rankFilter, setRankFilter] = useState<RankFilter>("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const { isRefreshingAll, handleRefreshAll } = useRefreshAllAccounts(accounts);

  const regions = useMemo(() => {
    const set = new Set(accounts.map((a) => a.platform));
    return [...set];
  }, [accounts]);

  const filteredAndSorted = useMemo(() => {
    let result = [...accounts];

    if (rankFilter === "ranked") {
      result = result.filter((a) => getSoloQueueStats(a));
    } else if (rankFilter === "unranked") {
      result = result.filter((a) => !getSoloQueueStats(a));
    }

    if (regionFilter !== "all") {
      result = result.filter((a) => a.platform === regionFilter);
    }

    switch (sortMode) {
      case "rank":
        result.sort(compareLeagueAccounts);
        break;
      case "name-asc":
        result.sort((a, b) => a.gameName.localeCompare(b.gameName));
        break;
      case "name-desc":
        result.sort((a, b) => b.gameName.localeCompare(a.gameName));
        break;
    }

    return result;
  }, [accounts, sortMode, rankFilter, regionFilter]);

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">
          {RIOT_GAME_LABELS[game]}
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
      </div>

      {accounts.length > 0 ? (
        <>
          <AccountToolbar
            sortMode={sortMode}
            onSortChange={setSortMode}
            rankFilter={rankFilter}
            onRankFilterChange={setRankFilter}
            regionFilter={regionFilter}
            onRegionFilterChange={setRegionFilter}
            regions={regions}
            isRefreshingAll={isRefreshingAll}
            onRefreshAll={handleRefreshAll}
          />

          {filteredAndSorted.length === 0 ? (
            <div className="flex min-h-[10vh] items-center justify-center rounded-xl border border-dashed border-border/50 px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                No accounts match the current filters.
              </p>
            </div>
          ) : (
            <PlatformGroupedAccountList
              accounts={filteredAndSorted}
              keyPrefix={game}
              showSections={regionFilter === "all"}
            />
          )}
        </>
      ) : (
        <HubEmptyState
          title="No Tagged Accounts Yet"
          description={`Add an account and tag it for ${RIOT_GAME_LABELS[game]} to have it show up here.`}
        />
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared components                                                 */
/* ------------------------------------------------------------------ */

function PlatformGroupedAccountList({
  accounts,
  keyPrefix,
  showSections = true,
}: {
  accounts: Account[];
  keyPrefix?: string;
  showSections?: boolean;
}) {
  const platformGroups = useMemo(
    () => groupAccountsByPlatform(accounts),
    [accounts],
  );
  const shouldGroup = showSections && platformGroups.size > 1;

  if (!shouldGroup) {
    return (
      <div className="flex flex-col gap-2">
        {accounts.map((account, i) => (
          <AccountRow
            key={keyPrefix ? `${account.userName}-${keyPrefix}` : account.userName}
            account={account}
            index={i}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {[...platformGroups.entries()].map(([platform, groupAccounts]) => (
        <div key={platform} className="space-y-2">
          <h3 className="flex items-center gap-3 text-sm font-medium text-muted-foreground/80 tracking-wide uppercase before:h-px before:w-6 before:bg-border">
            {getPlatformLabel(platform as Account["platform"])}
          </h3>
          <div className="flex flex-col gap-2">
            {groupAccounts.map((account, i) => (
              <AccountRow
                key={keyPrefix ? `${account.userName}-${keyPrefix}` : account.userName}
                account={account}
                index={i}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function HubEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="animate-in fade-in zoom-in-95 duration-500 relative flex min-h-[20vh] flex-col items-center justify-center gap-4 overflow-hidden rounded-xl border border-border/30 px-4 py-10 text-center">
      {/* Decorative faded rank emblem */}
      <img
        src={getRankEmblemPath(undefined)}
        alt=""
        className="pointer-events-none absolute size-32 object-contain opacity-[0.08]"
        aria-hidden="true"
      />
      <div className="relative z-10 space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="max-w-md text-muted-foreground">{description}</p>
      </div>
      <div className="relative z-10">
        <AddAccountDialog />
      </div>
    </div>
  );
}

function getSoloQueueStats(account: Account): LeagueEntryDTO | undefined {
  return getSoloQueueEntry(account.leagueData);
}

function compareLeagueAccounts(left: Account, right: Account): number {
  const leftStats = getSoloQueueStats(left);
  const rightStats = getSoloQueueStats(right);
  const rankDelta = compareLeagueEntries(leftStats, rightStats);

  return rankDelta !== 0
    ? rankDelta
    : left.gameName.localeCompare(right.gameName);
}
