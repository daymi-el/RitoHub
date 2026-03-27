import type {Platform} from "@zqz979/league-api-wrapper";
import {useState} from "react";
import {ChevronDown} from "lucide-react";
import {ChampionIcon} from "./champion-icon";
import {SpellIcon} from "./spell-icon";
import {ItemBuild} from "./item-build";
import {MatchRowDetail} from "./match-row-detail";
import type {PlayerMatch} from "@/lib/match-utils";
import {
    formatDecimal,
    formatDuration,
    formatKdaRatio,
    formatRelativeTime,
    getCsPerMinute,
    getItemIds,
    getMatchEndTimestamp,
    getMatchOutcome,
    getPositionLabel,
    getTotalCs,
    getKillParticipation,
} from "@/lib/match-utils";
import {getQueueLabel} from "@/lib/riot";
import {cn} from "@/lib/utils";

export function MatchRow({
                             playerMatch,
                             currentPuuid,
                             platform,
                         }: {
    playerMatch: PlayerMatch;
    currentPuuid: string;
    platform?: Platform;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const {match, participant, allies, opponents, teamKills} = playerMatch;
    const queueLabel = getQueueLabel(match.info.queueId);
    const gameEndTimestamp = getMatchEndTimestamp(match);
    const totalCs = getTotalCs(participant);
    const csPerMinute = formatDecimal(
        getCsPerMinute(totalCs, match.info.gameDuration),
    );
    const position = getPositionLabel(participant);
    const outcome = getMatchOutcome(participant);
    const detailsId = `match-details-${match.metadata.matchId}`;

    return (
        <article
            className={cn(
                "overflow-hidden rounded-md border border-l-[3px] bg-card",
                outcome.borderClassName,
            )}
        >
            <button
                type="button"
                className="w-full px-3 py-2 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => setIsOpen((v) => !v)}
                aria-expanded={isOpen}
                aria-controls={detailsId}
            >
                {/* Mobile: stacked 2-row layout */}
                <div className="flex flex-col gap-2 md:hidden">
                    <div className="flex items-center gap-2">
                        <ChampionIcon
                            championName={participant.championName}
                            size="md"
                        />
                        <div className="flex shrink-0 flex-col gap-0.5">
                            <SpellIcon spellId={participant.summoner1Id}/>
                            <SpellIcon spellId={participant.summoner2Id}/>
                        </div>

                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-foreground">
                                {participant.kills}/{participant.deaths}/
                                {participant.assists}
                                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  {formatKdaRatio(participant)} KDA
                </span>
                            </p>
                            <p
                                className={cn(
                                    "text-xs",
                                    outcome.textClassName,
                                )}
                            >
                                {outcome.label}
                                <span className="ml-1.5 text-muted-foreground">
                  {queueLabel}
                                    {position ? ` · ${position}` : ""}
                </span>
                            </p>
                        </div>

                        <ChevronDown
                            className={cn(
                                "size-4 shrink-0 text-muted-foreground transition-transform",
                                isOpen && "rotate-180",
                            )}
                        />
                    </div>

                    <div className="flex items-center justify-between gap-2 pl-[62px]">
                        <ItemBuild itemIds={getItemIds(participant)}/>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>
                {totalCs} CS ({csPerMinute}/m)
              </span>
                            <span>{formatDuration(match.info.gameDuration)}</span>
                        </div>
                    </div>
                </div>

                {/* Desktop: single-row layout */}
                <div className="hidden items-center gap-3 md:flex">
                    {/* Champion + spells */}
                    <div className="flex shrink-0 items-center gap-1.5">
                        <ChampionIcon
                            championName={participant.championName}
                            size="md"
                        />
                        <div className="flex flex-col gap-0.5">
                            <SpellIcon spellId={participant.summoner1Id}/>
                            <SpellIcon spellId={participant.summoner2Id}/>
                        </div>
                    </div>

                    {/* Outcome + queue */}
                    <div className="w-24 shrink-0">
                        <p
                            className={cn(
                                "text-xs font-medium",
                                outcome.textClassName,
                            )}
                        >
                            {outcome.label}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                            {queueLabel}
                        </p>
                        {position ? (
                            <p className="text-xs text-muted-foreground">{position}</p>
                        ) : null}
                    </div>

                    {/* KDA */}
                    <div className="w-28 shrink-0">
                        <p className="text-sm font-semibold text-foreground">
                            {participant.kills}/{participant.deaths}/
                            {participant.assists}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {formatKdaRatio(participant)} KDA
                            {teamKills > 0 ? (
                                <span className="ml-1">
                  · {getKillParticipation(participant, teamKills)} KP
                </span>
                            ) : null}
                        </p>
                    </div>

                    {/* CS + vision */}
                    <div className="w-20 shrink-0">
                        <p className="text-xs text-foreground">
                            {totalCs} CS ({csPerMinute}/m)
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Vision {participant.visionScore}
                        </p>
                    </div>

                    {/* Items */}
                    <div className="flex-1">
                        <ItemBuild itemIds={getItemIds(participant)}/>
                    </div>

                    {/* Teammate icons (lg+ only) */}
                    <div className="hidden shrink-0 lg:flex lg:items-center lg:gap-0.5">
                        {allies.slice(0, 5).map((ally) => (
                            <ChampionIcon
                                key={ally.puuid}
                                championName={ally.championName}
                                size="xs"
                            />
                        ))}
                    </div>

                    {/* Time */}
                    <div className="w-20 shrink-0 text-right">
                        <p className="text-xs text-muted-foreground">
                            {formatDuration(match.info.gameDuration)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {formatRelativeTime(gameEndTimestamp)}
                        </p>
                    </div>

                    {/* Chevron */}
                    <ChevronDown
                        className={cn(
                            "size-4 shrink-0 text-muted-foreground transition-transform",
                            isOpen && "rotate-180",
                        )}
                    />
                </div>
            </button>

            {isOpen ? (
                <MatchRowDetail
                    allies={allies}
                    opponents={opponents}
                    participant={participant}
                    currentPuuid={currentPuuid}
                    platform={platform}
                />
            ) : null}
        </article>
    );
}
