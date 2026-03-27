import {getLocalItemIconPath} from "@/lib/lol-static-data";
import {handleAssetLoadError} from "@/lib/match-utils";

export function ItemBuild({itemIds}: { itemIds: number[] }) {
    return (
        <div className="flex flex-wrap gap-1">
            {itemIds.map((itemId, index) => (
                <div
                    key={`${itemId}-${index}`}
                    className="relative flex h-6 w-6 items-center justify-center overflow-hidden rounded border bg-muted/20"
                >
                    {itemId > 0 ? (
                        <img
                            src={getLocalItemIconPath(itemId)}
                            alt={`Item ${itemId}`}
                            className="h-full w-full object-cover"
                            loading="lazy"
                            onError={handleAssetLoadError}
                        />
                    ) : null}
                </div>
            ))}
        </div>
    );
}
