import type {LeagueEntryDTO} from "@zqz979/league-api-wrapper";
import type {MatchHistorySummaryData} from "@/lib/match-utils";
import {
    formatRecord,
    getWinRatePercent,
} from "@/lib/match-utils";
import {formatLeagueRankLabel} from "@/lib/league-rank";
import {getPlatformLabel, getRankEmblemPath} from "@/lib/riot";

export function MatchHistorySummary({
                                        summary,
                                        rankedEntry,
                                        platform,
                                        matchCount,
                                    }: {
    summary: MatchHistorySummaryData;
    rankedEntry?: LeagueEntryDTO;
    platform: string;
    matchCount: number;
}) {
    return (
        <header className="rounded-md border bg-card px-4 py-3">
            <div className="flex items-center gap-6">
                <div className="flex shrink-0 items-center gap-3">
                    <img
                        src={getRankEmblemPath(rankedEntry?.tier)}
                        alt="Rank emblem"
                        className="h-12 w-12 object-contain"
                        loading="lazy"
                    />
                    <div>
                        <p className="text-sm font-semibold text-foreground">
                            {rankedEntry
                                ? formatLeagueRankLabel(rankedEntry)
                                : "Unranked"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Last {matchCount} on {getPlatformLabel(platform as never)}
                        </p>
                    </div>
                </div>

                <dl className="flex flex-wrap gap-6 text-sm">
                    <SummaryStat
                        label="W/L"
                        value={`${formatRecord(summary)} (${getWinRatePercent(summary)})`}
                    />
                    <SummaryStat label="Avg KDA" value={summary.averageKda}/>
                    <SummaryStat
                        label="Avg CS/min"
                        value={summary.averageCsPerMinute}
                    />
                </dl>
            </div>
        </header>
    );
}

function SummaryStat({
                         label,
                         value,
                     }: {
    label: string;
    value: string;
}) {
    return (
        <div className="flex items-baseline gap-2">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium">{value}</dd>
        </div>
    );
}
