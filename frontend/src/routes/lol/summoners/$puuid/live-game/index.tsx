import type { LeagueEntryDTO } from "@zqz979/league-api-wrapper";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { SyntheticEvent } from "react";
import { useEffect, useState } from "react";
import { ChevronLeft, Radio, RefreshCw } from "lucide-react";
import { LoginAccountButton } from "@/components/blocks/account-card";
import { AppPageHeader } from "@/components/blocks/app-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  type LiveGameParticipantData,
  type NormalizedCurrentGameInfo,
  useAccountLiveGame,
} from "@/hooks/use-account-live-game";
import {
  type LolStaticData,
  SUMMONER_SPELL_ASSETS,
  getChampionInitials,
  getLocalChampionBackdropPath,
  getLocalChampionIconPath,
  getLocalRuneIconPath,
  getLocalSummonerSpellPath,
  loadLolStaticData,
} from "@/lib/lol-static-data";
import { formatLeagueRankLabel, getPreferredRankedEntry } from "@/lib/league-rank";
import { alertRiotLoginError, loginToRiotAccount } from "@/lib/riot-client";
import {
  getMapLabel,
  getPlatformLabel,
  getQueueLabel,
  getRankEmblemPath,
} from "@/lib/riot";
import { GAME_ACCENT_COLORS } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAccounts } from "@/providers/accounts-context";

export const Route = createFileRoute("/lol/summoners/$puuid/live-game/")({
  component: RouteComponent,
});

/* ─── Team colour constants ─── */
const TEAM_BLUE = "oklch(0.65 0.15 245)";
const TEAM_RED = "oklch(0.60 0.18 25)";

function RouteComponent() {
  const { puuid } = Route.useParams();
  const { getAccountByPuuid, isLoaded } = useAccounts();
  const account = getAccountByPuuid(puuid);
  const {
    liveGame,
    participants,
    error,
    isLoading,
    isRefreshing,
    lastUpdatedAt,
    refresh,
  } = useAccountLiveGame(account);
  const { staticData, error: staticDataError } = useLolStaticData();

  if (!isLoaded) {
    return <LiveGameState title="Loading account..." />;
  }

  if (!account) {
    return <LiveGameState title="No account found" />;
  }

  const currentAccount = account;
  const currentParticipant = participants.find(
    ({ participant }) => participant.puuid === puuid,
  );
  const blueTeam = participants.filter(
    ({ participant }) => participant.teamId === 100,
  );
  const redTeam = participants.filter(
    ({ participant }) => participant.teamId === 200,
  );
  const blueBans =
    liveGame?.bannedChampions.filter((ban) => ban.teamId === 100) ?? [];
  const redBans =
    liveGame?.bannedChampions.filter((ban) => ban.teamId === 200) ?? [];

  async function handleLogin() {
    try {
      await loginToRiotAccount(currentAccount);
    } catch (nextError) {
      console.error("Failed to switch Riot account", nextError);
      alertRiotLoginError(nextError);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AppPageHeader
        title={`${currentAccount.gameName}#${currentAccount.tagLine}`}
        leading={<BackButton />}
        accentColor={GAME_ACCENT_COLORS["league-of-legends"]}
        trailing={
          <div className="flex items-center gap-2">
            <Link
              to="/lol/summoners/$puuid/overview"
              params={{ puuid }}
              search={{ platform: currentAccount.platform }}
            >
              <Button size="sm" variant="outline">
                Overview
              </Button>
            </Link>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={refresh}
              disabled={isLoading || isRefreshing}
            >
              <RefreshCw className={cn(isRefreshing && "animate-spin")} />
              Refresh
            </Button>
            <LoginAccountButton onLogin={handleLogin} />
          </div>
        }
      />

      <main className="flex flex-1 justify-center p-4 md:p-6">
        <div className="flex w-full max-w-7xl flex-col gap-5">
          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          )}

          {staticDataError && (
            <p className="rounded-lg border px-4 py-3 text-sm text-muted-foreground">
              Static League data could not be loaded, so some names and icons
              may be missing.
            </p>
          )}

          {isLoading ? (
            <LiveGameLoadingState />
          ) : !liveGame || !currentParticipant ? (
            <EmptyLiveGameState
              lastUpdatedAt={lastUpdatedAt}
              onRefresh={refresh}
            />
          ) : (
            <>
              <LiveGameSummary
                accountName={`${currentAccount.gameName}#${currentAccount.tagLine}`}
                currentParticipant={currentParticipant}
                lastUpdatedAt={lastUpdatedAt}
                liveGame={liveGame}
                platformLabel={getPlatformLabel(currentAccount.platform)}
                staticData={staticData}
              />

              <div className="grid gap-5 xl:grid-cols-2">
                <TeamSection
                  currentPuuid={puuid}
                  participants={blueTeam}
                  staticData={staticData}
                  title="Blue Team"
                  teamColor={TEAM_BLUE}
                  glowClass="live-game-blue-glow"
                />
                <TeamSection
                  currentPuuid={puuid}
                  participants={redTeam}
                  staticData={staticData}
                  title="Red Team"
                  teamColor={TEAM_RED}
                  glowClass="live-game-red-glow"
                />
              </div>

              {(blueBans.length > 0 || redBans.length > 0) && (
                <div className="grid gap-5 xl:grid-cols-2">
                  <BanSection
                    bans={blueBans}
                    staticData={staticData}
                    title="Blue Team Bans"
                    teamColor={TEAM_BLUE}
                  />
                  <BanSection
                    bans={redBans}
                    staticData={staticData}
                    title="Red Team Bans"
                    teamColor={TEAM_RED}
                  />
                </div>
              )}
            </>
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

function LiveGameState({ title }: { title: string }) {
  return (
    <div className="min-h-screen flex flex-col">
      <AppPageHeader title={title} leading={<BackButton />} accentColor={GAME_ACCENT_COLORS["league-of-legends"]} />
      <main className="flex flex-1 items-center justify-center p-4">
        <p className="text-muted-foreground">{title}</p>
      </main>
    </div>
  );
}

/* ─── Live Timer (ticks every second) ─── */
function LiveTimer({ liveGame }: { liveGame: NormalizedCurrentGameInfo }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsed = Math.max(
    liveGame.gameLength,
    Math.floor((now - liveGame.gameStartTime) / 1000),
    0,
  );
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  return (
    <span className="font-mono text-2xl font-bold tabular-nums tracking-tight">
      {mins}
      <span className="animate-timer-colon">:</span>
      {secs.toString().padStart(2, "0")}
    </span>
  );
}

/* ─── Hero / Summary Section ─── */
function LiveGameSummary({
  accountName,
  currentParticipant,
  lastUpdatedAt,
  liveGame,
  platformLabel,
  staticData,
}: {
  accountName: string;
  currentParticipant: LiveGameParticipantData;
  lastUpdatedAt: number | null;
  liveGame: NormalizedCurrentGameInfo;
  platformLabel: string;
  staticData: LolStaticData | null;
}) {
  const champion = getChampion(staticData, currentParticipant.participant.championId);
  const teamColor = currentParticipant.participant.teamId === 100 ? TEAM_BLUE : TEAM_RED;

  return (
    <section className="animate-hero-in relative overflow-hidden rounded-xl border bg-card">
      {/* Champion backdrop with dramatic gradient */}
      {champion.id ? (
        <div className="absolute inset-0">
          <img
            src={getLocalChampionBackdropPath(champion.id)}
            alt=""
            className="h-full w-full object-cover opacity-25 blur-[1px]"
            loading="lazy"
            onError={handleAssetLoadError}
          />
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, color-mix(in oklch, var(--card) 92%, transparent), color-mix(in oklch, var(--card) 80%, transparent) 60%, color-mix(in oklch, ${teamColor} 12%, var(--card)) 100%)`,
            }}
          />
        </div>
      ) : null}

      <div className="relative flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
        {/* Left: Player info */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <ChampionIcon
              championId={currentParticipant.participant.championId}
              className="h-[4.5rem] w-[4.5rem] rounded-xl text-lg ring-2 ring-offset-2 ring-offset-card"
              staticData={staticData}
              ringColor={teamColor}
            />
            {/* Summoner spells overlay */}
            <div className="absolute -bottom-1 -right-1 flex gap-0.5">
              <SpellIcon spellId={currentParticipant.participant.spell1Id} size="sm" />
              <SpellIcon spellId={currentParticipant.participant.spell2Id} size="sm" />
            </div>
          </div>

          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-xl font-bold tracking-tight">{accountName}</p>
              <Badge
                variant="outline"
                className="rounded-md border-current/20 font-semibold"
                style={{ color: teamColor }}
              >
                {getTeamLabel(currentParticipant.participant.teamId)}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {champion.name} &middot; {platformLabel}
            </p>
          </div>
        </div>

        {/* Right: Game meta */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 lg:gap-x-8">
          {/* Live timer */}
          <div className="animate-stat-in flex flex-col items-center gap-0.5">
            <LiveTimer liveGame={liveGame} />
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="animate-live-ring absolute inline-flex h-full w-full rounded-full bg-emerald-400" />
                <span className="animate-live-dot relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              LIVE
            </span>
          </div>

          <div className="animate-stat-in flex flex-col items-center" style={{ animationDelay: "60ms" }}>
            <span className="text-sm font-semibold">{getQueueLabel(liveGame.gameQueueConfigId)}</span>
            <span className="text-xs text-muted-foreground">{getMapLabel(liveGame.mapId)}</span>
          </div>

          <div className="animate-stat-in flex flex-col items-center" style={{ animationDelay: "120ms" }}>
            <span className="text-sm font-semibold">
              {lastUpdatedAt ? formatClockTime(lastUpdatedAt) : "..."}
            </span>
            <span className="text-xs text-muted-foreground">Last update</span>
          </div>
        </div>
      </div>

      {/* Bottom team color bar */}
      <div
        className="animate-team-bar h-[3px]"
        style={{
          background: `linear-gradient(to right, ${teamColor}, transparent)`,
        }}
      />
    </section>
  );
}

/* ─── Team Section ─── */
function TeamSection({
  currentPuuid,
  participants,
  staticData,
  title,
  teamColor,
  glowClass,
}: {
  currentPuuid: string;
  participants: LiveGameParticipantData[];
  staticData: LolStaticData | null;
  title: string;
  teamColor: string;
  glowClass: string;
}) {
  return (
    <section className={cn("overflow-hidden rounded-xl border bg-card", glowClass)}>
      <header className="flex items-center gap-3 border-b px-4 py-3">
        <div
          className="h-3 w-3 rounded-full"
          style={{ backgroundColor: teamColor }}
        />
        <h2 className="text-sm font-bold uppercase tracking-wide">{title}</h2>
      </header>

      {/* Column labels (desktop) */}
      <div className="hidden grid-cols-[minmax(0,1.7fr)_96px_96px_minmax(180px,1fr)] gap-3 border-b bg-muted/15 px-4 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground/70 md:grid">
        <span>Player</span>
        <span>Spells</span>
        <span>Runes</span>
        <span>Ranked</span>
      </div>

      <ul>
        {participants.map((entry, i) => (
          <PlayerRow
            key={entry.participant.puuid}
            currentPuuid={currentPuuid}
            entry={entry}
            staticData={staticData}
            teamColor={teamColor}
            index={i}
          />
        ))}
      </ul>
    </section>
  );
}

/* ─── Player Row ─── */
function PlayerRow({
  currentPuuid,
  entry,
  staticData,
  teamColor,
  index,
}: {
  currentPuuid: string;
  entry: LiveGameParticipantData;
  staticData: LolStaticData | null;
  teamColor: string;
  index: number;
}) {
  const { participant, account, leagueEntries } = entry;
  const champion = getChampion(staticData, participant.championId);
  const isCurrent = participant.puuid === currentPuuid;
  const primaryRuneId = participant.perks.perkIds[0];
  const secondaryRuneId = participant.perks.perkSubStyle;
  const rankSummary = getRankSummary(leagueEntries);

  return (
    <li
      className={cn(
        "animate-stat-in grid gap-3 border-t px-4 py-3 transition-colors md:grid-cols-[minmax(0,1.7fr)_96px_96px_minmax(180px,1fr)] md:items-center",
        isCurrent
          ? "bg-muted/30"
          : "hover:bg-muted/10",
      )}
      style={{
        animationDelay: `${index * 50}ms`,
        ...(isCurrent
          ? { borderLeftWidth: "3px", borderLeftColor: teamColor }
          : {}),
      }}
    >
      {/* Player identity */}
      <div className="flex min-w-0 items-center gap-3">
        <ChampionIcon
          championId={participant.championId}
          staticData={staticData}
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className={cn("truncate text-sm", isCurrent ? "font-bold" : "font-medium")}>
              {getParticipantName(account, participant.puuid)}
            </p>
            {isCurrent && (
              <Badge
                variant="outline"
                className="rounded-md text-[10px] px-1.5 py-0 border-current/25 font-semibold"
                style={{ color: teamColor }}
              >
                YOU
              </Badge>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {champion.name}
          </p>
        </div>
      </div>

      {/* Spells */}
      <div className="flex items-center gap-1.5">
        <SpellIcon spellId={participant.spell1Id} />
        <SpellIcon spellId={participant.spell2Id} />
      </div>

      {/* Runes */}
      <div className="flex items-center gap-1.5">
        <RuneIcon runeId={primaryRuneId} staticData={staticData} />
        <RuneIcon runeId={secondaryRuneId} staticData={staticData} />
      </div>

      {/* Rank */}
      <div className="flex items-center gap-2.5 text-sm">
        <img
          src={getRankEmblemPath(rankSummary.tier)}
          alt={`${rankSummary.value} emblem`}
          className="h-10 w-10 shrink-0 object-contain"
          loading="lazy"
        />
        <div className="min-w-0 space-y-0.5">
          <p className="truncate text-sm font-semibold">{rankSummary.value}</p>
          <p className="truncate text-xs text-muted-foreground">{rankSummary.detail}</p>
        </div>
      </div>
    </li>
  );
}

/* ─── Ban Section ─── */
function BanSection({
  bans,
  staticData,
  title,
  teamColor,
}: {
  bans: NormalizedCurrentGameInfo["bannedChampions"];
  staticData: LolStaticData | null;
  title: string;
  teamColor: string;
}) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <header className="flex items-center gap-3 border-b px-4 py-3">
        <div
          className="h-3 w-3 rounded-full"
          style={{ backgroundColor: teamColor }}
        />
        <h2 className="text-sm font-bold uppercase tracking-wide">{title}</h2>
      </header>

      {bans.length > 0 ? (
        <div className="flex flex-wrap gap-2 p-4">
          {bans.map((ban) => {
            const champion = getChampion(staticData, ban.championId);

            return (
              <div
                key={`${ban.teamId}-${ban.pickTurn}-${ban.championId}`}
                className="group flex items-center gap-2.5 rounded-lg border border-border/50 bg-muted/20 px-3 py-2 transition-colors hover:bg-muted/40"
              >
                <div className="relative">
                  <ChampionIcon
                    championId={ban.championId}
                    staticData={staticData}
                    className="h-9 w-9 rounded-md grayscale-[60%] group-hover:grayscale-0 transition-[filter]"
                  />
                  {/* Ban X overlay */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="h-5 w-5 text-destructive/70 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                      <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                      <line x1="20" y1="4" x2="4" y2="20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                  </div>
                </div>
                <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                  {champion.name}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="px-4 py-6 text-sm text-muted-foreground">
          No bans were returned for this match.
        </div>
      )}
    </section>
  );
}

/* ─── Empty / Loading States ─── */
function EmptyLiveGameState({
  lastUpdatedAt,
  onRefresh,
}: {
  lastUpdatedAt: number | null;
  onRefresh: () => void;
}) {
  return (
    <section className="flex min-h-[360px] flex-col items-center justify-center gap-5 rounded-xl border bg-card px-6 text-center">
      <div className="relative flex h-16 w-16 items-center justify-center rounded-full border-2 border-border/30 bg-muted/30">
        <Radio className="h-7 w-7 text-muted-foreground/60" />
      </div>
      <div className="space-y-1.5">
        <p className="text-lg font-semibold">
          Not in a game
        </p>
        <p className="text-sm text-muted-foreground">
          {lastUpdatedAt
            ? `Last checked at ${formatClockTime(lastUpdatedAt)}`
            : "Checking live game status..."}
        </p>
      </div>
      <Button type="button" variant="outline" onClick={onRefresh} className="gap-2">
        <RefreshCw className="h-3.5 w-3.5" />
        Check again
      </Button>
    </section>
  );
}

function LiveGameLoadingState() {
  return (
    <section
      className="overflow-hidden rounded-xl border bg-card"
      aria-hidden="true"
    >
      {/* Hero skeleton */}
      <div className="flex flex-col gap-4 border-b p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="h-[4.5rem] w-[4.5rem] animate-pulse rounded-xl bg-muted" />
          <div className="space-y-2">
            <div className="h-6 w-48 animate-pulse rounded bg-muted" />
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          </div>
        </div>
        <div className="flex gap-8">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className="h-6 w-16 animate-pulse rounded bg-muted" />
              <div className="h-3 w-12 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
      <div className="h-[3px] w-1/3 animate-pulse bg-muted" />

      {/* Team skeletons */}
      <div className="grid gap-5 p-5 xl:grid-cols-2">
        {Array.from({ length: 2 }, (_, teamIndex) => (
          <div key={teamIndex} className="overflow-hidden rounded-xl border">
            <div className="flex items-center gap-3 border-b px-4 py-3">
              <div className="h-3 w-3 animate-pulse rounded-full bg-muted" />
              <div className="h-4 w-20 animate-pulse rounded bg-muted" />
            </div>
            {Array.from({ length: 5 }, (_, rowIndex) => (
              <div
                key={rowIndex}
                className="grid gap-3 border-t px-4 py-3 md:grid-cols-[minmax(0,1.7fr)_96px_96px_minmax(180px,1fr)]"
              >
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 animate-pulse rounded-md bg-muted" />
                  <div className="space-y-2">
                    <div className="h-4 w-28 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-16 animate-pulse rounded bg-muted" />
                  </div>
                </div>

                <div className="flex gap-1.5">
                  <div className="h-9 w-9 animate-pulse rounded-md bg-muted" />
                  <div className="h-9 w-9 animate-pulse rounded-md bg-muted" />
                </div>

                <div className="flex gap-1.5">
                  <div className="h-9 w-9 animate-pulse rounded-md bg-muted" />
                  <div className="h-9 w-9 animate-pulse rounded-md bg-muted" />
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
                  <div className="space-y-1.5">
                    <div className="h-3.5 w-20 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-16 animate-pulse rounded bg-muted" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── Icon Components ─── */
function ChampionIcon({
  championId,
  className,
  staticData,
  ringColor,
}: {
  championId: number;
  className?: string;
  staticData: LolStaticData | null;
  ringColor?: string;
}) {
  const champion = getChampion(staticData, championId);

  return (
    <div
      className={cn(
        "relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted text-sm font-medium",
        className,
      )}
      style={ringColor ? { "--tw-ring-color": ringColor } as React.CSSProperties : undefined}
    >
      <span aria-hidden="true">{getChampionInitials(champion.name)}</span>
      {champion.id ? (
        <img
          src={getLocalChampionIconPath(champion.id)}
          alt={`${champion.name} icon`}
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
          onError={handleAssetLoadError}
        />
      ) : null}
    </div>
  );
}

function SpellIcon({ spellId, size = "md" }: { spellId: number; size?: "sm" | "md" }) {
  const spell = SUMMONER_SPELL_ASSETS[spellId];
  const sizeClass = size === "sm" ? "h-6 w-6 rounded text-[8px]" : "h-9 w-9 rounded-md text-[10px]";

  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden border bg-muted/50 text-muted-foreground",
        sizeClass,
      )}
      title={spell?.name ?? `Spell ${spellId}`}
    >
      <span aria-hidden="true">{spell?.name.slice(0, 1) ?? "?"}</span>
      {spell ? (
        <img
          src={getLocalSummonerSpellPath(spell.image)}
          alt={spell.name}
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
          onError={handleAssetLoadError}
        />
      ) : null}
    </div>
  );
}

function RuneIcon({
  runeId,
  staticData,
}: {
  runeId: number;
  staticData: LolStaticData | null;
}) {
  const rune = staticData?.runesById.get(runeId);

  return (
    <div
      className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-md border bg-muted/50 text-[10px] text-muted-foreground"
      title={rune?.name ?? `Rune ${runeId}`}
    >
      <span aria-hidden="true">{rune?.name.slice(0, 1) ?? "?"}</span>
      {rune ? (
        <img
          src={getLocalRuneIconPath(rune.icon)}
          alt={rune.name}
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
          onError={handleAssetLoadError}
        />
      ) : null}
    </div>
  );
}

/* ─── Hooks ─── */
function useLolStaticData() {
  const [staticData, setStaticData] = useState<LolStaticData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;

    async function loadStaticData() {
      try {
        const nextStaticData = await loadLolStaticData();

        if (!isCurrent) {
          return;
        }

        setStaticData(nextStaticData);
      } catch (nextError) {
        if (!isCurrent) {
          return;
        }

        setError(
          nextError instanceof Error
            ? nextError.message
            : "Failed to load League static data.",
        );
      }
    }

    void loadStaticData();

    return () => {
      isCurrent = false;
    };
  }, []);

  return { staticData, error };
}

/* ─── Helpers ─── */
function getChampion(staticData: LolStaticData | null, championId: number) {
  const champion =
    championId > 0 ? staticData?.championsById.get(championId) : null;

  return {
    id: champion?.id ?? "",
    name: champion?.name ?? (championId > 0 ? `Champion ${championId}` : "No ban"),
  };
}

function getParticipantName(
  account: { gameName?: string | null; tagLine?: string | null } | null,
  puuid: string,
): string {
  if (account?.gameName && account.tagLine) {
    return `${account.gameName}#${account.tagLine}`;
  }

  return `${puuid.slice(0, 10)}...`;
}

function getRankSummary(leagueEntries: LeagueEntryDTO[]) {
  const soloEntry = leagueEntries.find(
    (entry) => entry.queueType === "RANKED_SOLO_5x5",
  );
  const primaryEntry = getPreferredRankedEntry(leagueEntries);

  if (!primaryEntry) {
    return {
      tier: undefined,
      value: "Unranked",
      detail: "No ranked data",
    };
  }

  const winRate = getWinRate(primaryEntry.wins, primaryEntry.losses);

  return {
    tier: primaryEntry.tier,
    value: formatLeagueRankLabel(primaryEntry),
    detail: `${soloEntry ? "Solo/Duo" : "Flex"} · ${primaryEntry.leaguePoints} LP · ${winRate}% WR`,
  };
}

function getWinRate(wins: number, losses: number): number {
  const totalGames = wins + losses;

  if (totalGames === 0) {
    return 0;
  }

  return Math.round((wins / totalGames) * 100);
}

function formatClockTime(timestamp: number): string {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(timestamp);
}

function getTeamLabel(teamId: number): string {
  switch (teamId) {
    case 100:
      return "Blue";
    case 200:
      return "Red";
    default:
      return `Team ${teamId}`;
  }
}

function handleAssetLoadError(event: SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.style.display = "none";
}
