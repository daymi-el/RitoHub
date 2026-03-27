import type {Platform, Region} from "@zqz979/league-api-wrapper";

interface PlatformOption {
    value: Platform;
    label: string;
    region: Region;
}

export const PLATFORM_OPTIONS = [
    {value: "BR1", label: "Brazil", region: "AMERICAS"},
    {value: "LA1", label: "Latin America North", region: "AMERICAS"},
    {value: "LA2", label: "Latin America South", region: "AMERICAS"},
    {value: "NA1", label: "North America", region: "AMERICAS"},
    {value: "EUN1", label: "Europe Nordic & East", region: "EUROPE"},
    {value: "EUW1", label: "Europe West", region: "EUROPE"},
    {value: "RU", label: "Russia", region: "EUROPE"},
    {value: "TR1", label: "Turkey", region: "EUROPE"},
    {value: "JP1", label: "Japan", region: "ASIA"},
    {value: "KR", label: "Korea", region: "ASIA"},
    {value: "PH2", label: "Philippines", region: "SEA"},
    {value: "SG2", label: "Singapore", region: "SEA"},
    {value: "TH2", label: "Thailand", region: "SEA"},
    {value: "TW2", label: "Taiwan", region: "SEA"},
    {value: "VN2", label: "Vietnam", region: "SEA"},
    {value: "OC1", label: "Oceania", region: "SEA"},
] as const satisfies readonly PlatformOption[];

export const SUPPORTED_PLATFORM_VALUES = PLATFORM_OPTIONS.map(
    ({value}) => value,
) as [Platform, ...Platform[]];

export function isSupportedPlatform(value: unknown): value is Platform {
    return (
        typeof value === "string" &&
        SUPPORTED_PLATFORM_VALUES.includes(value as Platform)
    );
}

const DEFAULT_PLATFORM_BY_REGION: Record<Region, Platform> = {
    AMERICAS: "NA1",
    ASIA: "KR",
    EUROPE: "EUW1",
    SEA: "SG2",
};

export function getRegionForPlatform(platform: Platform): Region {
    const option = PLATFORM_OPTIONS.find((item) => item.value === platform);
    return option?.region ?? "EUROPE";
}

export function getDefaultPlatformForRegion(region: Region): Platform {
    return DEFAULT_PLATFORM_BY_REGION[region];
}

export function getPlatformLabel(platform: Platform): string {
    const option = PLATFORM_OPTIONS.find((item) => item.value === platform);
    return option?.label ?? platform;
}

export function getQueueLabel(queueId: number): string {
    switch (queueId) {
        case 400:
            return "Normal Draft";
        case 420:
            return "Ranked Solo/Duo";
        case 430:
            return "Normal Blind";
        case 440:
            return "Ranked Flex";
        case 450:
            return "ARAM";
        case 700:
            return "Clash";
        case 900:
            return "ARURF";
        default:
            return `Queue ${queueId}`;
    }
}

export function getMapLabel(mapId: number): string {
    switch (mapId) {
        case 11:
            return "Summoner's Rift";
        case 12:
            return "Howling Abyss";
        case 21:
            return "Nexus Blitz";
        case 30:
            return "Arena";
        default:
            return `Map ${mapId}`;
    }
}

export function getRankEmblemPath(tier?: string): string {
    if (!tier) {
        return "/rank-emblems/Rank=Unranked.png";
    }

    const titleCaseTier =
        tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase();

    return `/rank-emblems/Rank=${titleCaseTier}.png`;
}
