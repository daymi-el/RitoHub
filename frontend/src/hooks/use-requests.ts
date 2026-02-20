import {useMemo} from "react";
import {type AccountDto, type LeagueEntryDTO, type Platform, type Region, RiotClient} from "@zqz979/league-api-wrapper";


export const useRequests = () => {
    const API_KEY = import.meta.env.VITE_API_KEY!;

    const client = useMemo(() => new RiotClient({apiKey: API_KEY}), [API_KEY])

    async function getRiotAccount(gameName: string, tagLine: string, region: Region): Promise<AccountDto> {
        return (await client.account.getAccountByRiotId(region, gameName, tagLine))
    }

    async function getLeagueAccountData(puuid: string, platform: Platform): Promise<LeagueEntryDTO[]> {
        return (await client.league.getLeagueEntriesByPuuid(platform, puuid))
    }

    interface getMatchHistoryProps {
        region: Region,
        puuid: string,
        startTime?: number,
        endTime?: number,
        queue?: number,
        type?: string,
        start?: number,
        count?: number,
    }

    async function getMatchHistoryIDs(params: getMatchHistoryProps) {
        const {region, puuid, startTime, endTime, queue, type, start} = params;

        const count = params.count || 5

        return (await client.match.getMatchIdsByPuuid(region, puuid, startTime, endTime, queue, type, start, count))
    }


    async function getMatchHistoryByPUUID(params: getMatchHistoryProps) {
        const matchIDs = await getMatchHistoryIDs(params)

        return await Promise.all(
            matchIDs.map(async (matchID) => (await client.match.getMatchByMatchId(params.region, matchID))
            )
        )
    }

    return {
        getRiotAccount,
        getLeagueAccountData,
        getMatchHistoryByPUUID
    }
}