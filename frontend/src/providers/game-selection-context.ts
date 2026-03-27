import {createContext, useContext} from "react";
import type {RiotGame} from "@/lib/types";

export interface GameSelectionContextType {
    selectedGame: RiotGame;
    setSelectedGame: (game: RiotGame) => void;
}

export const GameSelectionContext =
    createContext<GameSelectionContextType | null>(null);

export function useGameSelection(): GameSelectionContextType {
    const context = useContext(GameSelectionContext);

    if (!context) {
        throw new Error(
            "useGameSelection must be used within a GameSelectionProvider",
        );
    }

    return context;
}
