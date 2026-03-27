import type {
    MatchDto,
    ParticipantDto,
} from "@zqz979/league-api-wrapper";
import type {SyntheticEvent} from "react";

export interface PlayerMatch {
    match: MatchDto;
    participant: ParticipantDto;
    allies: ParticipantDto[];
    opponents: ParticipantDto[];
    teamKills: number;
}

export interface MatchHistorySummaryData {
    wins: number;
    losses: number;
    remakes: number;
    averageKda: string;
    averageCsPerMinute: string;
}

export type MatchOutcome = {
    borderClassName: string;
    textClassName: string;
    label: string;
};

const relativeTimeFormatter = new Intl.RelativeTimeFormat("en", {
    numeric: "auto",
});

export function getPlayerMatches(
    matchHistory: MatchDto[],
    puuid: string,
): PlayerMatch[] {
    return matchHistory.flatMap((match) => {
        const participant = match.info.participants.find(
            (player) => player.puuid === puuid,
        );

        if (!participant) {
            return [];
        }

        const allies = [...match.info.participants]
            .filter((player) => player.teamId === participant.teamId)
            .sort((left, right) => {
                if (left.puuid === puuid) {
                    return -1;
                }

                if (right.puuid === puuid) {
                    return 1;
                }

                return left.participantId - right.participantId;
            });
        const opponents = [...match.info.participants]
            .filter((player) => player.teamId !== participant.teamId)
            .sort((left, right) => left.participantId - right.participantId);
        const teamKills = allies.reduce(
            (total, player) => total + player.kills,
            0,
        );

        return [
            {
                match,
                participant,
                allies,
                opponents,
                teamKills,
            },
        ];
    });
}

export function getMatchHistorySummary(
    playerMatches: PlayerMatch[],
): MatchHistorySummaryData {
    const wins = playerMatches.filter(
        ({participant}) => participant.win && !isRemake(participant),
    ).length;
    const remakes = playerMatches.filter(({participant}) =>
        isRemake(participant),
    ).length;
    const losses = playerMatches.length - wins - remakes;
    const averageKda =
        playerMatches.reduce(
            (total, {participant}) => total + getKdaRatioValue(participant),
            0,
        ) / playerMatches.length;
    const averageCsPerMinute =
        playerMatches.reduce(
            (total, {match, participant}) =>
                total +
                getCsPerMinute(getTotalCs(participant), match.info.gameDuration),
            0,
        ) / playerMatches.length;

    return {
        wins,
        losses,
        remakes,
        averageKda: formatDecimal(averageKda),
        averageCsPerMinute: formatDecimal(averageCsPerMinute),
    };
}

export function isRemake(participant: ParticipantDto): boolean {
    return participant.gameEndedInEarlySurrender;
}

export function getMatchOutcome(participant: ParticipantDto): MatchOutcome {
    if (isRemake(participant)) {
        return {
            borderClassName: "border-l-amber-500",
            textClassName: "text-amber-700 dark:text-amber-400",
            label: "Remake",
        };
    }

    if (participant.win) {
        return {
            borderClassName: "border-l-emerald-500",
            textClassName: "text-emerald-700 dark:text-emerald-400",
            label: "Victory",
        };
    }

    return {
        borderClassName: "border-l-rose-500",
        textClassName: "text-rose-700 dark:text-rose-400",
        label: "Defeat",
    };
}

export function getMatchEndTimestamp(match: MatchDto): number {
    if (match.info.gameEndTimestamp > 0) {
        return match.info.gameEndTimestamp;
    }

    return match.info.gameCreation + match.info.gameDuration * 1000;
}

export function getPositionLabel(
    participant: ParticipantDto,
): string | null {
    const rawPosition =
        participant.teamPosition ||
        participant.individualPosition ||
        participant.role ||
        participant.lane;

    switch (rawPosition) {
        case "TOP":
            return "Top";
        case "JUNGLE":
            return "Jungle";
        case "MIDDLE":
            return "Mid";
        case "BOTTOM":
            return "Bottom";
        case "UTILITY":
            return "Support";
        case "DUO":
            return "Duo";
        case "SOLO":
            return "Solo";
        default:
            return rawPosition &&
            rawPosition !== "NONE" &&
            rawPosition !== "INVALID"
                ? toTitleCase(rawPosition)
                : null;
    }
}

export function getParticipantDisplayName(
    participant: ParticipantDto,
): string {
    if (participant.riotIdGameName && participant.riotIdTagline) {
        return `${participant.riotIdGameName}#${participant.riotIdTagline}`;
    }

    return participant.summonerName;
}

export function getItemIds(participant: ParticipantDto): number[] {
    return [
        participant.item0,
        participant.item1,
        participant.item2,
        participant.item3,
        participant.item4,
        participant.item5,
        participant.item6,
    ];
}

export function getTotalCs(participant: ParticipantDto): number {
    return participant.totalMinionsKilled + participant.neutralMinionsKilled;
}

export function getCsPerMinute(
    cs: number,
    durationSeconds: number,
): number {
    const durationMinutes = Math.max(durationSeconds / 60, 1);
    return cs / durationMinutes;
}

export function getKillParticipation(
    participant: ParticipantDto,
    teamKills: number,
): string {
    const value =
        ((participant.kills + participant.assists) / teamKills) * 100;
    return `${Math.round(value)}%`;
}

export function getKdaRatioValue(participant: ParticipantDto): number {
    if (participant.deaths === 0) {
        return participant.kills + participant.assists;
    }

    return (participant.kills + participant.assists) / participant.deaths;
}

export function formatKdaRatio(participant: ParticipantDto): string {
    if (participant.deaths === 0) {
        return "Perfect";
    }

    return formatDecimal(getKdaRatioValue(participant));
}

export function formatDuration(durationSeconds: number): string {
    const minutes = Math.floor(durationSeconds / 60);
    const seconds = durationSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function formatRelativeTime(timestamp: number): string {
    const minuteDelta = Math.round((timestamp - Date.now()) / 60000);

    if (Math.abs(minuteDelta) < 60) {
        return relativeTimeFormatter.format(minuteDelta, "minute");
    }

    const hourDelta = Math.round(minuteDelta / 60);

    if (Math.abs(hourDelta) < 24) {
        return relativeTimeFormatter.format(hourDelta, "hour");
    }

    const dayDelta = Math.round(hourDelta / 24);
    return relativeTimeFormatter.format(dayDelta, "day");
}

export function formatCompactNumber(value: number): string {
    return new Intl.NumberFormat("en", {
        notation: "compact",
        maximumFractionDigits: 1,
    }).format(value);
}

export function formatDecimal(value: number): string {
    return value.toFixed(1).replace(".0", "");
}

export function formatRecord(summary: MatchHistorySummaryData): string {
    if (summary.remakes > 0) {
        return `${summary.wins}W ${summary.losses}L ${summary.remakes}R`;
    }

    return `${summary.wins}W ${summary.losses}L`;
}

export function getWinRatePercent(
    summary: MatchHistorySummaryData,
): string {
    const totalGames = summary.wins + summary.losses;
    if (totalGames === 0) {
        return "0%";
    }

    return `${Math.round((summary.wins / totalGames) * 100)}%`;
}

export function toTitleCase(value: string): string {
    return value
        .toLowerCase()
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

export function handleAssetLoadError(
    event: SyntheticEvent<HTMLImageElement>,
) {
    event.currentTarget.style.display = "none";
}
