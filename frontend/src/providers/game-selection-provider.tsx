import {type ReactNode, useCallback, useEffect, useMemo, useState} from "react";
import {useLocation, useNavigate} from "@tanstack/react-router";
import {RIOT_GAMES, type RiotGame} from "@/lib/types";
import {GameSelectionContext} from "@/providers/game-selection-context";
import {useAccounts} from "@/providers/accounts-context";

const STORAGE_KEY = "ritohub:selected-game";

function isValidGame(value: unknown): value is RiotGame {
    return typeof value === "string" && RIOT_GAMES.includes(value as RiotGame);
}

function getStoredGame(): RiotGame | null {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return isValidGame(stored) ? stored : null;
    } catch {
        return null;
    }
}

function storeGame(game: RiotGame): void {
    try {
        localStorage.setItem(STORAGE_KEY, game);
    } catch {
        // Ignore storage errors
    }
}

function detectBestGame(accountsList: { games: RiotGame[] }[]): RiotGame {
    const counts = RIOT_GAMES.map(
        (game) => [game, accountsList.filter((a) => a.games.includes(game)).length] as const,
    );

    // Pick the game with most accounts; tie-break by RIOT_GAMES order (LoL first)
    const best = counts.reduce((winner, current) =>
        current[1] > winner[1] ? current : winner,
    );

    return best[1] > 0 ? best[0] : "league-of-legends";
}

interface GameSelectionProviderProps {
    children: ReactNode;
}

export function GameSelectionProvider({children}: GameSelectionProviderProps) {
    const {accountsList, isLoaded} = useAccounts();
    const navigate = useNavigate();
    const location = useLocation();

    const [selectedGame, setSelectedGameState] = useState<RiotGame>(() => {
        return getStoredGame() ?? "league-of-legends";
    });

    // Once accounts load, if no stored preference exists, auto-detect
    useEffect(() => {
        if (!isLoaded) return;
        const stored = getStoredGame();
        if (stored) return;
        const best = detectBestGame(accountsList);
        setSelectedGameState(best);
        storeGame(best);
    }, [isLoaded, accountsList]);

    const setSelectedGame = useCallback(
        (game: RiotGame) => {
            setSelectedGameState(game);
            storeGame(game);

            // If on a sub-page, navigate home when switching games
            if (location.pathname !== "/") {
                void navigate({to: "/"});
            }
        },
        [location.pathname, navigate],
    );

    const value = useMemo(
        () => ({selectedGame, setSelectedGame}),
        [selectedGame, setSelectedGame],
    );

    return (
        <GameSelectionContext.Provider value={value}>
            {children}
        </GameSelectionContext.Provider>
    );
}
