import type {MatchDto} from "@zqz979/league-api-wrapper";
import {useEffect, useState} from "react";
import {fetchMatchHistory} from "@/lib/riot-api";
import type {Account} from "@/lib/types";

interface MatchHistoryRequest {
    platform: Account["platform"];
    puuid: string;
}

interface MatchHistoryState {
    matchHistory: MatchDto[];
    error: string | null;
    resolvedRequestKey: string | null;
}

const initialState: MatchHistoryState = {
    matchHistory: [],
    error: null,
    resolvedRequestKey: null,
};

export function useAccountMatchHistory(
    request: MatchHistoryRequest | undefined,
    count = 10,
) {
    const [state, setState] = useState<MatchHistoryState>(initialState);
    const requestKey = request ? `${request.platform}:${request.puuid}:${count}` : null;

    useEffect(() => {
        if (!request) {
            return;
        }

        const currentRequest = request;
        const currentRequestKey = `${currentRequest.platform}:${currentRequest.puuid}:${count}`;
        let isCurrent = true;

        async function loadMatchHistory() {
            try {
                const nextMatchHistory = await fetchMatchHistory({
                    platform: currentRequest.platform,
                    puuid: currentRequest.puuid,
                    count,
                });

                if (!isCurrent) {
                    return;
                }

                setState({
                    matchHistory: nextMatchHistory,
                    error: null,
                    resolvedRequestKey: currentRequestKey,
                });
            } catch (nextError) {
                if (!isCurrent) {
                    return;
                }

                setState({
                    matchHistory: [],
                    error:
                        nextError instanceof Error
                            ? nextError.message
                            : "Failed to load match history.",
                    resolvedRequestKey: currentRequestKey,
                });
            }
        }

        void loadMatchHistory();

        return () => {
            isCurrent = false;
        };
    }, [request, count]);

    const resolvedState = request ? state : initialState;
    const isLoading =
        requestKey !== null && resolvedState.resolvedRequestKey !== requestKey;

    return {
        matchHistory: resolvedState.matchHistory,
        error: resolvedState.error,
        isLoading,
    };
}
