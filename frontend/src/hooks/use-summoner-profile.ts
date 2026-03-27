import type {
    AccountDto,
    LeagueEntryDTO,
} from "@zqz979/league-api-wrapper";
import {useEffect, useState} from "react";
import {fetchSummonerProfile} from "@/lib/riot-api";
import type {Account} from "@/lib/types";

export interface SummonerProfile {
    gameName: string;
    tagLine: string;
    leagueData: LeagueEntryDTO[];
    platform: Account["platform"];
    riotData: AccountDto;
}

interface SummonerProfileState {
    error: string | null;
    profile: SummonerProfile | null;
    resolvedRequestKey: string | null;
}

const initialState: SummonerProfileState = {
    error: null,
    profile: null,
    resolvedRequestKey: null,
};

export function useSummonerProfile(
    account: Account | undefined,
    puuid: string,
    platform: Account["platform"] | undefined,
) {
    const [state, setState] = useState<SummonerProfileState>(initialState);
    const requestKey = account ? null : platform ? `${platform}:${puuid}` : null;

    useEffect(() => {
        if (account || !platform) {
            return;
        }

        const currentPlatform = platform;
        const currentRequestKey = `${currentPlatform}:${puuid}`;
        let isCurrent = true;

        async function loadSummonerProfile() {
            try {
                const {riotData, leagueData} = await fetchSummonerProfile(
                    puuid,
                    currentPlatform,
                );

                if (!isCurrent) {
                    return;
                }

                setState({
                    error: null,
                    profile: {
                        gameName: riotData.gameName,
                        tagLine: riotData.tagLine,
                        leagueData,
                        platform: currentPlatform,
                        riotData,
                    },
                    resolvedRequestKey: currentRequestKey,
                });
            } catch (error) {
                if (!isCurrent) {
                    return;
                }

                setState({
                    error:
                        error instanceof Error
                            ? error.message
                            : "Failed to load summoner profile.",
                    profile: null,
                    resolvedRequestKey: currentRequestKey,
                });
            }
        }

        void loadSummonerProfile();

        return () => {
            isCurrent = false;
        };
    }, [account, platform, puuid]);

    if (account) {
        return {
            error: null,
            isLoading: false,
            isSavedAccount: true,
            profile: {
                gameName: account.gameName,
                tagLine: account.tagLine,
                leagueData: account.leagueData,
                platform: account.platform,
                riotData: account.riotData,
            } satisfies SummonerProfile,
        };
    }

    return {
        error: state.error,
        isLoading:
            requestKey !== null && state.resolvedRequestKey !== requestKey,
        isSavedAccount: false,
        profile: state.profile,
    };
}
