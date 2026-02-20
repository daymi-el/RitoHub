import type {AccountDto, LeagueEntryDTO, Region} from "@zqz979/league-api-wrapper";

export interface Account {
    gameName: string;
    tagLine: string;
    userName: string;
    password: string;
    region: Region;
    riotData: AccountDto;
    leagueData: LeagueEntryDTO[];
}