import type {AccountDto, LeagueEntryDTO, Platform, Region,} from "@zqz979/league-api-wrapper";

export const RIOT_GAMES = ["league-of-legends", "valorant", "tft"] as const;

export type RiotGame = (typeof RIOT_GAMES)[number];

export const RIOT_GAME_LABELS: Record<RiotGame, string> = {
    "league-of-legends": "League of Legends",
    valorant: "Valorant",
    tft: "Teamfight Tactics",
};

export const GAME_ACCENT_COLORS: Record<RiotGame, string> = {
    "league-of-legends": "oklch(0.72 0.16 82)",
    valorant: "oklch(0.68 0.21 24)",
    tft: "oklch(0.74 0.14 215)",
};

export const GAME_DESCRIPTIONS: Record<RiotGame, string> = {
    "league-of-legends":
        "Track ranked progress, recent matches, live games, and launch directly into the Riot Client.",
    valorant:
        "Organize Riot accounts tagged for Valorant and keep them ready for quick client switching.",
    tft:
        "Group Teamfight Tactics accounts in one place alongside your other Riot identities.",
};

export interface Account {
    games: RiotGame[];
    gameName: string;
    tagLine: string;
    userName: string;
    password: string;
    platform: Platform;
    region: Region;
    riotData: AccountDto;
    leagueData: LeagueEntryDTO[];
}
