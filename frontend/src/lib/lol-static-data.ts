interface ChampionCatalogEntry {
    id: string;
    key: string;
    name: string;
}

interface ChampionCatalogResponse {
    data: Record<string, ChampionCatalogEntry>;
}

interface RuneCatalogEntry {
    id: number;
    icon: string;
    name: string;
    slots: Array<{
        runes: RuneCatalogEntry[];
    }>;
}

export interface ChampionStaticData {
    id: string;
    key: string;
    name: string;
}

export interface RuneStaticData {
    id: number;
    icon: string;
    name: string;
}

export interface LolStaticData {
    championsById: Map<number, ChampionStaticData>;
    runesById: Map<number, RuneStaticData>;
}

export const DRAGONTAIL_VERSION = "16.5.1";
export const DRAGONTAIL_BASE_PATH = `/dragontail-${DRAGONTAIL_VERSION}`;

export const SUMMONER_SPELL_ASSETS: Record<
    number,
    { name: string; image: string }
> = {
    1: {name: "Cleanse", image: "SummonerBoost.png"},
    3: {name: "Exhaust", image: "SummonerExhaust.png"},
    4: {name: "Flash", image: "SummonerFlash.png"},
    6: {name: "Ghost", image: "SummonerHaste.png"},
    7: {name: "Heal", image: "SummonerHeal.png"},
    11: {name: "Smite", image: "SummonerSmite.png"},
    12: {name: "Teleport", image: "SummonerTeleport.png"},
    13: {name: "Clarity", image: "SummonerMana.png"},
    14: {name: "Ignite", image: "SummonerDot.png"},
    21: {name: "Barrier", image: "SummonerBarrier.png"},
    30: {name: "To the King!", image: "SummonerPoroRecall.png"},
    31: {name: "Poro Toss", image: "SummonerPoroThrow.png"},
    32: {name: "Mark", image: "SummonerSnowball.png"},
    39: {name: "Mark", image: "SummonerSnowURFSnowball_Mark.png"},
};

let staticDataPromise: Promise<LolStaticData> | null = null;

export function loadLolStaticData(): Promise<LolStaticData> {
    if (!staticDataPromise) {
        staticDataPromise = Promise.all([
            loadChampionCatalog(),
            loadRuneCatalog(),
        ]).then(([champions, runes]) => ({
            championsById: champions,
            runesById: runes,
        }));
    }

    return staticDataPromise;
}

async function loadChampionCatalog(): Promise<Map<number, ChampionStaticData>> {
    const response = await fetch(
        `${DRAGONTAIL_BASE_PATH}/${DRAGONTAIL_VERSION}/data/en_GB/champion.json`,
    );

    if (!response.ok) {
        throw new Error("Failed to load champion data.");
    }

    const payload = (await response.json()) as ChampionCatalogResponse;

    return new Map(
        Object.values(payload.data).map((champion) => [
            Number(champion.key),
            {
                id: champion.id,
                key: champion.key,
                name: champion.name,
            },
        ]),
    );
}

async function loadRuneCatalog(): Promise<Map<number, RuneStaticData>> {
    const response = await fetch(
        `${DRAGONTAIL_BASE_PATH}/${DRAGONTAIL_VERSION}/data/en_GB/runesReforged.json`,
    );

    if (!response.ok) {
        throw new Error("Failed to load rune data.");
    }

    const payload = (await response.json()) as RuneCatalogEntry[];
    const runesById = new Map<number, RuneStaticData>();

    for (const tree of payload) {
        runesById.set(tree.id, {
            id: tree.id,
            icon: tree.icon,
            name: tree.name,
        });

        for (const slot of tree.slots) {
            for (const rune of slot.runes) {
                runesById.set(rune.id, {
                    id: rune.id,
                    icon: rune.icon,
                    name: rune.name,
                });
            }
        }
    }

    return runesById;
}

export function getLocalChampionIconPath(championId: string): string {
    return `${DRAGONTAIL_BASE_PATH}/${DRAGONTAIL_VERSION}/img/champion/${championId}.png`;
}

export function getLocalChampionBackdropPath(championId: string): string {
    return `${DRAGONTAIL_BASE_PATH}/img/champion/centered/${championId}_0.jpg`;
}

export function getLocalItemIconPath(itemId: number): string {
    return `${DRAGONTAIL_BASE_PATH}/${DRAGONTAIL_VERSION}/img/item/${itemId}.png`;
}

export function getLocalSummonerSpellPath(imageName: string): string {
    return `${DRAGONTAIL_BASE_PATH}/${DRAGONTAIL_VERSION}/img/spell/${imageName}`;
}

export function getLocalRuneIconPath(iconPath: string): string {
    return `${DRAGONTAIL_BASE_PATH}/img/${iconPath}`;
}

export function getChampionInitials(championName: string): string {
    const matches = championName.match(/[A-Z][a-z]*/g);

    if (matches && matches.length > 1) {
        return matches
            .slice(0, 2)
            .map((part) => part[0])
            .join("");
    }

    return championName.slice(0, 2).toUpperCase();
}
