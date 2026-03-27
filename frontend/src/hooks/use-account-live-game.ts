import {
    type AccountDto,
    type CurrentGameInfo,
    type CurrentGameParticipant,
    type LeagueEntryDTO,
} from "@zqz979/league-api-wrapper";
import {useEffect, useState} from "react";
import type {Account} from "@/lib/types";
import {
    fetchCurrentGame,
    fetchLeagueEntries,
    fetchRiotAccountByPuuid,
} from "@/lib/riot-api";

const REFRESH_INTERVAL_MS = 30_000;

export interface LiveGameParticipantData {
    participant: CurrentGameParticipant;
    account: AccountDto | null;
    leagueEntries: LeagueEntryDTO[];
}

export interface NormalizedCurrentGameInfo
    extends Omit<CurrentGameInfo, "participants"> {
    participants: CurrentGameParticipant[];
}

interface AccountLiveGameState {
    liveGame: NormalizedCurrentGameInfo | null;
    participants: LiveGameParticipantData[];
    error: string | null;
    lastUpdatedAt: number | null;
    resolvedRequestKey: string | null;
}

const initialState: AccountLiveGameState = {
    liveGame: null,
    participants: [],
    error: null,
    lastUpdatedAt: null,
    resolvedRequestKey: null,
};

export function useAccountLiveGame(account: Account | undefined) {
    const [refreshTick, setRefreshTick] = useState(0);
    const [state, setState] = useState<AccountLiveGameState>(initialState);
    const requestKey = account ? `${account.riotData.puuid}:${refreshTick}` : null;

    useEffect(() => {
        if (!account) {
            return;
        }

        const timerId = window.setInterval(() => {
            if (document.visibilityState !== "visible") {
                return;
            }

            setRefreshTick((currentValue) => currentValue + 1);
        }, REFRESH_INTERVAL_MS);

        return () => {
            window.clearInterval(timerId);
        };
    }, [account]);

    useEffect(() => {
        if (!account) {
            return;
        }

        const currentAccount = account;
        const currentRequestKey = `${currentAccount.riotData.puuid}:${refreshTick}`;
        let isCurrent = true;

        async function loadLiveGame() {
            try {
                const rawLiveGame = await fetchCurrentGame(
                    currentAccount.riotData.puuid,
                    currentAccount.platform,
                );

                const liveGame = normalizeCurrentGame(rawLiveGame);
                const participants = await Promise.all(
                    liveGame.participants.map((participant) =>
                        loadParticipantData(participant, currentAccount.platform),
                    ),
                );

                if (!isCurrent) {
                    return;
                }

                setState({
                    liveGame,
                    participants,
                    error: null,
                    lastUpdatedAt: Date.now(),
                    resolvedRequestKey: currentRequestKey,
                });
            } catch (error) {
                if (!isCurrent) {
                    return;
                }

                if (isLiveGameNotFoundError(error)) {
                    setState({
                        liveGame: null,
                        participants: [],
                        error: null,
                        lastUpdatedAt: Date.now(),
                        resolvedRequestKey: currentRequestKey,
                    });

                    return;
                }

                setState({
                    liveGame: null,
                    participants: [],
                    error: getErrorMessage(error, "Failed to load live game."),
                    lastUpdatedAt: Date.now(),
                    resolvedRequestKey: currentRequestKey,
                });
            }
        }

        void loadLiveGame();

        return () => {
            isCurrent = false;
        };
    }, [account, refreshTick]);

    const resolvedState = account ? state : initialState;
    const isPending =
        requestKey !== null && resolvedState.resolvedRequestKey !== requestKey;
    const isLoading = isPending && resolvedState.lastUpdatedAt === null;
    const isRefreshing = isPending && resolvedState.lastUpdatedAt !== null;

    return {
        ...resolvedState,
        isLoading,
        isRefreshing,
        refresh() {
            setRefreshTick((currentValue) => currentValue + 1);
        },
    };
}

async function loadParticipantData(
    participant: CurrentGameParticipant,
    platform: Account["platform"],
): Promise<LiveGameParticipantData> {
    const [accountResult, leagueEntriesResult] = await Promise.allSettled([
        fetchRiotAccountByPuuid(participant.puuid, platform),
        fetchLeagueEntries(participant.puuid, platform),
    ]);

    return {
        participant,
        account:
            accountResult.status === "fulfilled" ? accountResult.value : null,
        leagueEntries:
            leagueEntriesResult.status === "fulfilled" ? leagueEntriesResult.value : [],
    };
}

function normalizeCurrentGame(rawLiveGame: CurrentGameInfo): NormalizedCurrentGameInfo {
    const rawParticipants = (
        rawLiveGame as CurrentGameInfo & {
            participants?: CurrentGameParticipant[] | CurrentGameParticipant;
        }
    ).participants;

    return {
        ...rawLiveGame,
        participants: Array.isArray(rawParticipants)
            ? rawParticipants
            : rawParticipants
                ? [rawParticipants]
                : [],
    };
}

function isLiveGameNotFoundError(error: unknown): boolean {
    const status = getErrorStatus(error);

    if (status === 404) {
        return true;
    }

    if (!(error instanceof Error)) {
        return false;
    }

    return /\b404\b/.test(error.message) || /not found/i.test(error.message);
}

function getErrorStatus(error: unknown): number | null {
    if (!error || typeof error !== "object") {
        return null;
    }

    if ("status" in error && typeof error.status === "number") {
        return error.status;
    }

    if (
        "response" in error &&
        error.response &&
        typeof error.response === "object" &&
        "status" in error.response &&
        typeof error.response.status === "number"
    ) {
        return error.response.status;
    }

    return null;
}

function getErrorMessage(error: unknown, fallbackMessage: string): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }

    return fallbackMessage;
}
