import {invoke} from "@tauri-apps/api/core";
import type {
    AccountDto,
    CurrentGameInfo,
    LeagueEntryDTO,
    MatchDto,
    Platform,
} from "@zqz979/league-api-wrapper";

interface MatchHistoryParams {
    platform: Platform;
    puuid: string;
    startTime?: number;
    endTime?: number;
    queue?: number;
    type?: string;
    start?: number;
    count?: number;
}

export interface RiotAccountBundle {
    riotData: AccountDto;
    leagueData: LeagueEntryDTO[];
}

async function invokeRitoHub<T>(
    command: string,
    args?: Record<string, unknown>,
): Promise<T> {
    return invoke<T>(command, args);
}

export async function lookupRiotAccountBundle(
    gameName: string,
    tagLine: string,
    platform: Platform,
): Promise<RiotAccountBundle> {
    return invokeRitoHub<RiotAccountBundle>("lookup_riot_account", {
        request: {gameName, tagLine, platform},
    });
}

export async function fetchSummonerProfile(
    puuid: string,
    platform: Platform,
    options?: {
        gameName?: string;
        tagLine?: string;
    },
): Promise<RiotAccountBundle> {
    return invokeRitoHub<RiotAccountBundle>("get_summoner_profile", {
        request: {
            puuid,
            platform,
            gameName: options?.gameName,
            tagLine: options?.tagLine,
        },
    });
}

export async function fetchLeagueEntries(
    puuid: string,
    platform: Platform,
    options?: {
        gameName?: string;
        tagLine?: string;
    },
): Promise<LeagueEntryDTO[]> {
    return invokeRitoHub<LeagueEntryDTO[]>("get_league_entries", {
        request: {
            puuid,
            platform,
            gameName: options?.gameName,
            tagLine: options?.tagLine,
        },
    });
}

export async function fetchRiotAccountByPuuid(
    puuid: string,
    platform: Platform,
): Promise<AccountDto> {
    return invokeRitoHub<AccountDto>("get_riot_account_by_puuid", {
        request: {puuid, platform},
    });
}

export async function fetchCurrentGame(
    puuid: string,
    platform: Platform,
): Promise<CurrentGameInfo> {
    return invokeRitoHub<CurrentGameInfo>("get_current_game", {
        request: {puuid, platform},
    });
}

export async function fetchMatchHistory({
                                            platform,
                                            puuid,
                                            startTime,
                                            endTime,
                                            queue,
                                            type,
                                            start,
                                            count = 5,
                                        }: MatchHistoryParams): Promise<MatchDto[]> {
    return invokeRitoHub<MatchDto[]>("get_match_history", {
        request: {
            platform,
            puuid,
            startTime,
            endTime,
            queue,
            type,
            start,
            count,
        },
    });
}
