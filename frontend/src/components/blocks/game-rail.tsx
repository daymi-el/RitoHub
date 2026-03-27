import {useMemo} from "react";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    GAME_ACCENT_COLORS,
    RIOT_GAMES,
    RIOT_GAME_LABELS,
    type RiotGame,
} from "@/lib/types";
import {useAccounts} from "@/providers/accounts-context";
import {useGameSelection} from "@/providers/game-selection-context";

/* ─── Game Logo SVG Icons ─── */

/** League of Legends icon (source: Simple Icons, MIT license) */
function LeagueOfLegendsIcon({className}: { className?: string }) {
    return (
        <svg
            role="img"
            viewBox="0 0 24 24"
            fill="currentColor"
            className={className}
        >
            <path
                d="m1.912 0 1.212 2.474v19.053L1.912 24h14.73l1.337-4.682H8.33V0ZM12 1.516c-.913 0-1.798.112-2.648.312v1.74a9.738 9.738 0 0 1 2.648-.368c5.267 0 9.536 4.184 9.536 9.348a9.203 9.203 0 0 1-2.3 6.086l-.273.954-.602 2.112c2.952-1.993 4.89-5.335 4.89-9.122C23.25 6.468 18.213 1.516 12 1.516Zm0 2.673c-.924 0-1.814.148-2.648.414v13.713h8.817a8.246 8.246 0 0 0 2.36-5.768c0-4.617-3.818-8.359-8.529-8.359zM2.104 7.312A10.858 10.858 0 0 0 .75 12.576c0 1.906.492 3.7 1.355 5.266z"/>
        </svg>
    );
}

/** Valorant icon (source: Simple Icons, MIT license) */
function ValorantIcon({className}: { className?: string }) {
    return (
        <svg
            role="img"
            viewBox="0 0 24 24"
            fill="currentColor"
            className={className}
        >
            <path
                d="M23.792 2.152a.252.252 0 0 0-.098.083c-3.384 4.23-6.769 8.46-10.15 12.69-.107.093-.025.288.119.265 2.439.003 4.877 0 7.316.001a.66.66 0 0 0 .552-.25c.774-.967 1.55-1.934 2.324-2.903a.72.72 0 0 0 .144-.49c-.002-3.077 0-6.153-.003-9.23.016-.11-.1-.206-.204-.167zM.077 2.166c-.077.038-.074.132-.076.205.002 3.074.001 6.15.001 9.225a.679.679 0 0 0 .158.463l7.64 9.55c.12.152.308.25.505.247 2.455 0 4.91.003 7.365 0 .142.02.222-.174.116-.265C10.661 15.176 5.526 8.766.4 2.35c-.08-.094-.174-.272-.322-.184z"/>
        </svg>
    );
}

/**
 * Teamfight Tactics icon — a hexagonal chess-piece silhouette
 * inspired by the game's identity. Hand-crafted SVG.
 */
function TftIcon({className}: { className?: string }) {
    return (
        <svg
            role="img"
            viewBox="0 0 24 24"
            fill="currentColor"
            className={className}
        >
            {/* Hexagonal board shape */}
            <path
                d="M12 1.5 L21.5 6.75 L21.5 17.25 L12 22.5 L2.5 17.25 L2.5 6.75 Z M12 4 L5 7.8 L5 16.2 L12 20 L19 16.2 L19 7.8 Z"
                fillRule="evenodd"/>
            {/* Chess piece (crown/king) in center */}
            <path d="M9.5 16h5v1h-5zM9.8 15h4.4l.3-2h-5zM8.5 12l1.5-3 1 1.5L12 8.5l1 2 1-1.5 1.5 3z"/>
        </svg>
    );
}

const GAME_ICONS: Record<RiotGame, (props: { className?: string }) => React.JSX.Element> = {
    "league-of-legends": LeagueOfLegendsIcon,
    valorant: ValorantIcon,
    tft: TftIcon,
};

export function GameRail() {
    const {selectedGame, setSelectedGame} = useGameSelection();
    const {accountsList} = useAccounts();

    const gameData = useMemo(
        () =>
            RIOT_GAMES.map((game) => ({
                game,
                label: RIOT_GAME_LABELS[game],
                count: accountsList.filter((a) => a.games.includes(game)).length,
                accent: GAME_ACCENT_COLORS[game],
            })),
        [accountsList],
    );

    return (
        <nav
            className="flex h-screen w-14 shrink-0 flex-col items-center gap-1.5 border-r border-border/50 bg-card/80 backdrop-blur-sm pt-3 pb-3">
            {gameData.map(({game, label, count, accent}) => (
                <GameRailButton
                    key={game}
                    accent={accent}
                    count={count}
                    game={game}
                    isSelected={game === selectedGame}
                    label={label}
                    onSelect={() => setSelectedGame(game)}
                />
            ))}

            <div className="mt-auto"/>
        </nav>
    );
}

function GameRailButton({
                            accent,
                            count,
                            game,
                            isSelected,
                            label,
                            onSelect,
                        }: {
    accent: string;
    count: number;
    game: RiotGame;
    isSelected: boolean;
    label: string;
    onSelect: () => void;
}) {
    const Icon = GAME_ICONS[game];

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    type="button"
                    className="group relative flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    style={
                        {
                            "--rail-accent": accent,
                            color: isSelected
                                ? accent
                                : "color-mix(in oklch, var(--foreground) 50%, transparent)",
                            background: isSelected
                                ? `radial-gradient(circle at center, color-mix(in oklch, ${accent} 15%, transparent), color-mix(in oklch, ${accent} 5%, transparent) 70%)`
                                : undefined,
                        } as React.CSSProperties
                    }
                    onClick={onSelect}
                >
                    {/* Left accent bar */}
                    {isSelected && (
                        <span
                            className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full animate-rail-accent-in"
                            style={{backgroundColor: accent}}
                        />
                    )}

                    {/* Game logo icon */}
                    <Icon className="h-5 w-5 transition-colors duration-200"/>

                    {/* Hover ring */}
                    <span
                        className="pointer-events-none absolute inset-0 rounded-lg border border-transparent transition-colors duration-200 group-hover:border-border/40"
                        style={
                            isSelected
                                ? {
                                    borderColor: `color-mix(in oklch, ${accent} 25%, transparent)`,
                                }
                                : undefined
                        }
                    />
                </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
                <span>{label}</span>
                {count > 0 && (
                    <span className="ml-1.5 opacity-60">({count})</span>
                )}
            </TooltipContent>
        </Tooltip>
    );
}
