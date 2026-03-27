import type {ParticipantDto} from "@zqz979/league-api-wrapper";
import {ChampionIcon} from "./champion-icon";
import {
    formatCompactNumber,
    getParticipantDisplayName,
} from "@/lib/match-utils";

export function PlayerStatPanel({
                                    participant,
                                }: {
    participant: ParticipantDto;
}) {
    return (
        <section className="rounded-md border bg-card">
            <div className="flex flex-col gap-4 px-4 py-4">
                <div className="flex items-center gap-3">
                    <ChampionIcon
                        championName={participant.championName}
                        size="md"
                    />
                    <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                            {getParticipantDisplayName(participant)}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                            {participant.championName}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <StatCell
                        label="Vision"
                        value={participant.visionScore.toString()}
                    />
                    <StatCell
                        label="Damage"
                        value={formatCompactNumber(
                            participant.totalDamageDealtToChampions,
                        )}
                    />
                    <StatCell
                        label="Damage taken"
                        value={formatCompactNumber(participant.totalDamageTaken)}
                    />
                    <StatCell
                        label="Control wards"
                        value={participant.visionWardsBoughtInGame.toString()}
                    />
                    <StatCell
                        label="Wards cleared"
                        value={participant.wardsKilled.toString()}
                    />
                    <StatCell
                        label="Turrets"
                        value={participant.turretTakedowns.toString()}
                    />
                </div>
            </div>
        </section>
    );
}

function StatCell({label, value}: { label: string; value: string }) {
    return (
        <div className="rounded-sm border bg-muted/30 px-3 py-2">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-sm font-medium text-foreground">{value}</p>
        </div>
    );
}
