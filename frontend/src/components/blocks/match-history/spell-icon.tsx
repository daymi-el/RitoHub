import {
    SUMMONER_SPELL_ASSETS,
    getLocalSummonerSpellPath,
} from "@/lib/lol-static-data";
import {handleAssetLoadError} from "@/lib/match-utils";
import {cn} from "@/lib/utils";

export function SpellIcon({
                              spellId,
                              className,
                          }: {
    spellId: number;
    className?: string;
}) {
    const spell = SUMMONER_SPELL_ASSETS[spellId];

    return (
        <div
            className={cn(
                "relative flex h-[18px] w-[18px] items-center justify-center overflow-hidden rounded border bg-muted/50 text-[8px] text-muted-foreground",
                className,
            )}
            title={spell?.name ?? `Spell ${spellId}`}
        >
            <span aria-hidden="true">{spell?.name.slice(0, 1) ?? "?"}</span>
            {spell ? (
                <img
                    src={getLocalSummonerSpellPath(spell.image)}
                    alt={spell.name}
                    className="absolute inset-0 h-full w-full object-cover"
                    loading="lazy"
                    onError={handleAssetLoadError}
                />
            ) : null}
        </div>
    );
}
