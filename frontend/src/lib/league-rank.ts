import type {LeagueEntryDTO} from "@zqz979/league-api-wrapper";

export const SOLO_DUO_QUEUE = "RANKED_SOLO_5x5";
export const FLEX_QUEUE = "RANKED_FLEX_SR";

export const APEX_TIERS = new Set(["MASTER", "GRANDMASTER", "CHALLENGER"]);

const TIER_STRENGTH: Record<string, number> = {
    IRON: 0,
    BRONZE: 1,
    SILVER: 2,
    GOLD: 3,
    PLATINUM: 4,
    EMERALD: 5,
    DIAMOND: 6,
    MASTER: 7,
    GRANDMASTER: 8,
    CHALLENGER: 9,
};

const DIVISION_STRENGTH: Record<string, number> = {
    IV: 1,
    III: 2,
    II: 3,
    I: 4,
};

export function calculateLeagueWinrate(wins: number, losses: number): number {
    const totalGames = wins + losses;
    return totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
}

export function formatLeagueRankLabel(stats: LeagueEntryDTO): string {
    if (APEX_TIERS.has(stats.tier)) {
        return stats.tier;
    }

    return `${stats.tier} ${stats.rank}`;
}

export function getSoloQueueEntry(
    entries: LeagueEntryDTO[],
): LeagueEntryDTO | undefined {
    return entries.find((queue) => queue.queueType === SOLO_DUO_QUEUE);
}

export function getPreferredRankedEntry(
    entries: LeagueEntryDTO[],
): LeagueEntryDTO | undefined {
    return (
        getSoloQueueEntry(entries) ??
        entries.find((queue) => String(queue.queueType) === FLEX_QUEUE)
    );
}

export function compareLeagueEntries(
    left?: LeagueEntryDTO,
    right?: LeagueEntryDTO,
): number {
    if (!left && !right) {
        return 0;
    }

    if (!left) {
        return 1;
    }

    if (!right) {
        return -1;
    }

    const tierDelta = getTierStrength(right.tier) - getTierStrength(left.tier);

    if (tierDelta !== 0) {
        return tierDelta;
    }

    const divisionDelta =
        getDivisionStrength(right.rank) - getDivisionStrength(left.rank);

    if (divisionDelta !== 0) {
        return divisionDelta;
    }

    return right.leaguePoints - left.leaguePoints;
}

export function getBestLeagueEntry(
    entries: LeagueEntryDTO[],
): LeagueEntryDTO | undefined {
    return [...entries].sort(compareLeagueEntries)[0];
}

export function getTierAccentColor(tier?: string): string {
    const map: Record<string, string> = {
        IRON: "var(--tier-iron)",
        BRONZE: "var(--tier-bronze)",
        SILVER: "var(--tier-silver)",
        GOLD: "var(--tier-gold)",
        PLATINUM: "var(--tier-platinum)",
        EMERALD: "var(--tier-emerald)",
        DIAMOND: "var(--tier-diamond)",
        MASTER: "var(--tier-master)",
        GRANDMASTER: "var(--tier-grandmaster)",
        CHALLENGER: "var(--tier-challenger)",
    };
    return map[tier?.toUpperCase() ?? ""] ?? "var(--tier-unranked)";
}

function getTierStrength(tier?: string): number {
    if (!tier) {
        return -1;
    }

    return TIER_STRENGTH[tier.toUpperCase()] ?? -1;
}

function getDivisionStrength(rank?: string): number {
    if (!rank) {
        return 0;
    }

    return DIVISION_STRENGTH[rank.toUpperCase()] ?? 0;
}
