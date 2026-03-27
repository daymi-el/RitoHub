import {
    getChampionInitials,
    getLocalChampionIconPath,
} from "@/lib/lol-static-data";
import {handleAssetLoadError} from "@/lib/match-utils";
import {cn} from "@/lib/utils";

type ChampionIconSize = "xs" | "sm" | "md";

const sizeClasses: Record<ChampionIconSize, string> = {
    xs: "h-5 w-5 text-[8px]",
    sm: "h-8 w-8 text-[10px]",
    md: "h-10 w-10 text-xs",
};

export function ChampionIcon({
                                 championName,
                                 size = "md",
                                 className,
                             }: {
    championName: string;
    size?: ChampionIconSize;
    className?: string;
}) {
    return (
        <div
            className={cn(
                "relative flex shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted font-semibold",
                sizeClasses[size],
                className,
            )}
        >
            <span aria-hidden="true">{getChampionInitials(championName)}</span>
            <img
                src={getLocalChampionIconPath(championName)}
                alt={`${championName} icon`}
                className="absolute inset-0 h-full w-full object-cover"
                loading="lazy"
                onError={handleAssetLoadError}
            />
        </div>
    );
}
