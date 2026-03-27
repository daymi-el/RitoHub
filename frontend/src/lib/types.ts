import type {
    AccountDto,
    LeagueEntryDTO,
    Platform,
    Region,
} from "@zqz979/league-api-wrapper";

export const RIOT_GAMES = ["league-of-legends", "valorant", "tft"] as const;

export type RiotGame = (typeof RIOT_GAMES)[number];

export const RIOT_GAME_LABELS: Record<RiotGame, string> = {
    "league-of-legends": "League of Legends",
    valorant: "Valorant",
    tft: "Teamfight Tactics",
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
