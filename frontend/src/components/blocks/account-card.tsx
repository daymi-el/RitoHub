import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { History, Loader2, LogIn, Radio, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  APEX_TIERS,
  SOLO_DUO_QUEUE,
  calculateLeagueWinrate,
  formatLeagueRankLabel,
  getTierAccentColor,
} from "@/lib/league-rank";
import { fetchSummonerProfile } from "@/lib/riot-api";
import { alertRiotLoginError, loginToRiotAccount } from "@/lib/riot-client";
import { getPlatformLabel, getRankEmblemPath } from "@/lib/riot";
import type { Account } from "@/lib/types";
import { useAccounts } from "@/providers/accounts-context";

interface AccountRowProps {
  account: Account;
  index?: number;
}

export function AccountRow({ account, index }: AccountRowProps) {
  const { removeAccount, updateAccount } = useAccounts();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const rankedStats = account.leagueData.find(
    (queue) => queue.queueType === SOLO_DUO_QUEUE,
  );

  const tier = rankedStats?.tier;
  const tierColor = getTierAccentColor(tier);
  const isApexTier = tier ? APEX_TIERS.has(tier) : false;
  const winrate = rankedStats
    ? calculateLeagueWinrate(rankedStats.wins, rankedStats.losses)
    : null;

  async function handleLogin() {
    try {
      await loginToRiotAccount(account);
    } catch (error) {
      console.error("Failed to switch Riot account", error);
      alertRiotLoginError(error);
    }
  }

  async function handleRefresh() {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
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
    } catch (error) {
      console.error("Failed to refresh account", error);
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <div
      className="animate-row-in group flex h-[4.5rem] items-center gap-3 rounded-xl border border-border/50 bg-card px-4 transition-all hover:shadow-[inset_3px_0_12px_-4px_var(--row-tier),0_0_12px_-4px_var(--row-tier)]"
      style={
        {
          "--row-tier": tierColor,
          "--row-index": index ?? 0,
          background: `linear-gradient(to right, color-mix(in oklch, ${tierColor} 6%, transparent), transparent 60%)`,
        } as React.CSSProperties
      }
    >
      {/* Tier accent bar */}
      <div
        className={`h-8 w-1 shrink-0 rounded-full transition-all duration-300 group-hover:h-full group-hover:shadow-[0_0_8px_var(--row-tier)] ${isApexTier ? "animate-tier-pulse" : ""}`}
        style={{ backgroundColor: tierColor }}
      />

      {/* Rank emblem */}
      <img
        src={getRankEmblemPath(tier)}
        alt=""
        className="size-10 shrink-0 object-contain transition-all duration-200 group-hover:drop-shadow-[0_0_6px_var(--row-tier)]"
        loading="lazy"
      />

      {/* Name block */}
      <div className="min-w-0 w-36 shrink-0">
        <p className="truncate text-sm font-semibold">
          {account.gameName}
          <span className="text-muted-foreground/70 text-xs">#{account.tagLine}</span>
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {getPlatformLabel(account.platform)}
        </p>
      </div>

      {/* Rank text */}
      <span
        className="w-24 shrink-0 text-sm font-bold tracking-tight"
        style={{ color: tierColor }}
      >
        {rankedStats ? formatLeagueRankLabel(rankedStats) : "Unranked"}
      </span>

      {/* LP display */}
      {rankedStats ? (
        <span className="hidden w-16 shrink-0 text-sm text-muted-foreground sm:block">
          {rankedStats.leaguePoints} LP
        </span>
      ) : (
        <span className="hidden w-16 shrink-0 sm:block" />
      )}

      {/* Win rate + W/L stats */}
      <span className="hidden w-36 shrink-0 text-xs text-muted-foreground md:block">
        {rankedStats
          ? `${winrate}% WR · ${rankedStats.wins}W ${rankedStats.losses}L`
          : ""}
      </span>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              asChild
              className="relative"
            >
              <Link
                to="/lol/summoners/$puuid/live-game"
                params={{ puuid: account.riotData.puuid }}
              >
                <Radio className="size-3.5" />
                <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                  <span className="animate-live-ring absolute inline-flex h-full w-full rounded-full bg-emerald-400" />
                  <span className="animate-live-dot relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <span>Live game</span>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              asChild
            >
              <Link
                to="/lol/summoners/$puuid/overview"
                params={{ puuid: account.riotData.puuid }}
                search={{ platform: account.platform }}
              >
                <History className="size-3.5" />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <span>Match history</span>
          </TooltipContent>
        </Tooltip>
        <LoginAccountButton onLogin={handleLogin} />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
              onClick={handleRefresh}
              disabled={isRefreshing}
              aria-busy={isRefreshing}
            >
              <RefreshCw className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <span>{isRefreshing ? "Refreshing..." : "Refresh account"}</span>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-destructive opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
              onClick={() => removeAccount(account.userName)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <span>Remove account</span>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

export function LoginAccountButton({
  onLogin,
}: {
  onLogin: () => Promise<void>;
}) {
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  async function handleClick() {
    if (isLoggingIn) {
      return;
    }

    setIsLoggingIn(true);

    try {
      await onLogin();
    } finally {
      setIsLoggingIn(false);
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          size="icon-sm"
          className={isLoggingIn ? "animate-login-pulse" : ""}
          onClick={handleClick}
          disabled={isLoggingIn}
          aria-busy={isLoggingIn}
        >
          {isLoggingIn ? <Loader2 className="animate-spin" /> : <LogIn />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <span>{isLoggingIn ? "Logging in..." : "Log into account"}</span>
      </TooltipContent>
    </Tooltip>
  );
}
