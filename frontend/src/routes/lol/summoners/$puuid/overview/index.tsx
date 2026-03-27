import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { LoginAccountButton } from "@/components/blocks/account-card";
import { AppPageHeader } from "@/components/blocks/app-page-header";
import {
  MatchHistorySkeleton,
  MatchHistorySummary,
  MatchRow,
} from "@/components/blocks/match-history";
import { Button } from "@/components/ui/button";
import { useAccountMatchHistory } from "@/hooks/use-account-match-history";
import { useSummonerProfile } from "@/hooks/use-summoner-profile";
import { getPreferredRankedEntry } from "@/lib/league-rank";
import {
  getMatchHistorySummary,
  getPlayerMatches,
} from "@/lib/match-utils";
import { alertRiotLoginError, loginToRiotAccount } from "@/lib/riot-client";
import { isSupportedPlatform } from "@/lib/riot";
import { GAME_ACCENT_COLORS } from "@/lib/types";
import { useAccounts } from "@/providers/accounts-context";

const INITIAL_MATCH_COUNT = 10;
const LOAD_MORE_STEP = 10;

export const Route = createFileRoute("/lol/summoners/$puuid/overview/")({
  validateSearch: (search: Record<string, unknown>) => ({
    platform: isSupportedPlatform(search.platform) ? search.platform : undefined,
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const { puuid } = Route.useParams();
  const { platform: requestedPlatform } = Route.useSearch();
  const { getAccountByPuuid, isLoaded } = useAccounts();
  const [matchCount, setMatchCount] = useState(INITIAL_MATCH_COUNT);
  const account = getAccountByPuuid(puuid);
  const platform = account?.platform ?? requestedPlatform;
  const {
    profile,
    error: profileError,
    isLoading: isProfileLoading,
    isSavedAccount,
  } = useSummonerProfile(account, puuid, platform);
  const { matchHistory, error, isLoading } = useAccountMatchHistory(
    platform ? { platform, puuid } : undefined,
    matchCount,
  );
  const playerMatches = getPlayerMatches(matchHistory, puuid);
  const summary = getMatchHistorySummary(playerMatches);
  const isInitialMatchLoad = isLoading && playerMatches.length === 0;
  const isLoadingMore = isLoading && playerMatches.length > 0;
  const canLoadMore = !isLoading && matchHistory.length >= matchCount;

  useEffect(() => {
    setMatchCount(INITIAL_MATCH_COUNT);
  }, [platform, puuid]);

  if (!isLoaded || isProfileLoading) {
    return <OverviewState title="Loading account..." />;
  }

  if (!profile || !platform) {
    return <OverviewState title="No account found" />;
  }

  const rankedEntry = getPreferredRankedEntry(profile.leagueData);

  async function handleLogin() {
    if (!account) {
      return;
    }

    try {
      await loginToRiotAccount(account);
    } catch (nextError) {
      console.error("Failed to switch Riot account", nextError);
      alertRiotLoginError(nextError);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AppPageHeader
        title={`${profile.gameName}#${profile.tagLine}`}
        leading={<BackButton />}
        accentColor={GAME_ACCENT_COLORS["league-of-legends"]}
        trailing={
          isSavedAccount ? (
            <div className="flex items-center gap-2">
              <Link
                to="/lol/summoners/$puuid/live-game"
                params={{ puuid: profile.riotData.puuid }}
              >
                <Button size="sm" variant="outline">
                  Live game
                </Button>
              </Link>
              <LoginAccountButton onLogin={handleLogin} />
            </div>
          ) : null
        }
      />

      <main className="flex flex-1 justify-center p-4 md:p-6">
        <div className="flex w-full max-w-[84rem] flex-col gap-4">
          {(profileError || error) && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {profileError ?? error}
            </p>
          )}

          {isInitialMatchLoad ? (
            <MatchHistorySkeleton />
          ) : playerMatches.length === 0 ? (
            <EmptyMatchHistory />
          ) : (
            <section className="flex flex-col gap-3">
              <MatchHistorySummary
                summary={summary}
                rankedEntry={rankedEntry}
                platform={platform}
                matchCount={playerMatches.length}
              />

              <div className="space-y-2">
                {playerMatches.map((playerMatch) => (
                  <MatchRow
                    key={playerMatch.match.metadata.matchId}
                    playerMatch={playerMatch}
                    currentPuuid={puuid}
                    platform={platform}
                  />
                ))}
              </div>

              {(canLoadMore || isLoadingMore) && (
                <div className="flex justify-center pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setMatchCount((currentCount) => currentCount + LOAD_MORE_STEP)
                    }
                    disabled={isLoadingMore}
                  >
                    {isLoadingMore ? "Loading more..." : "Load more"}
                  </Button>
                </div>
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

function BackButton() {
  return (
    <Link
      to="/"
      className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ChevronLeft className="h-4 w-4" />
      <span>League of Legends</span>
    </Link>
  );
}

function OverviewState({ title }: { title: string }) {
  return (
    <div className="min-h-screen flex flex-col">
      <AppPageHeader title={title} leading={<BackButton />} accentColor={GAME_ACCENT_COLORS["league-of-legends"]} />
      <main className="flex flex-1 items-center justify-center p-4">
        <p className="text-muted-foreground">{title}</p>
      </main>
    </div>
  );
}

function EmptyMatchHistory() {
  return (
    <section className="flex min-h-[320px] items-center justify-center rounded-md border bg-card px-6 text-center">
      <p className="text-sm text-muted-foreground">
        No recent matches were found for this account.
      </p>
    </section>
  );
}
