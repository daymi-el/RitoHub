import type {ParticipantDto, Platform} from "@zqz979/league-api-wrapper";
import {Link} from "@tanstack/react-router";
import {ChampionIcon} from "./champion-icon";
import {getParticipantDisplayName} from "@/lib/match-utils";
import {cn} from "@/lib/utils";

export function TeamList({
                             label,
                             participants,
                             currentPuuid,
                             platform,
                         }: {
    label: string;
    participants: ParticipantDto[];
    currentPuuid?: string;
    platform?: Platform;
}) {
    return (
        <section className="rounded-md border bg-muted/10 px-3 py-3">
            <p className="mb-3 text-sm font-medium text-foreground">{label}</p>
            <ul className="space-y-2">
                {participants.map((player) => {
                    const isCurrentPlayer = player.puuid === currentPuuid;

                    return (
                        <li key={player.puuid}>
                            <Link
                                to="/lol/summoners/$puuid/overview"
                                params={{puuid: player.puuid}}
                                search={{platform}}
                                className={cn(
                                    "flex items-center justify-between gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                    isCurrentPlayer && "bg-muted/60",
                                )}
                            >
                                <div className="flex min-w-0 items-center gap-2">
                                    <ChampionIcon
                                        championName={player.championName}
                                        size="sm"
                                    />
                                    <div className="min-w-0">
                                        <p
                                            className={cn(
                                                "truncate text-sm text-foreground",
                                                isCurrentPlayer && "font-medium",
                                            )}
                                        >
                                            {getParticipantDisplayName(player)}
                                        </p>
                                        <p className="truncate text-xs text-muted-foreground">
                                            {player.championName}
                                        </p>
                                    </div>
                                </div>
                                <span className="shrink-0 text-xs text-muted-foreground">
                  {player.kills}/{player.deaths}/{player.assists}
                </span>
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
