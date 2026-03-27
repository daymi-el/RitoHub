import {invoke} from "@tauri-apps/api/core";
import {
    RIOT_GAMES,
    type Account,
    type RiotGame,
} from "@/lib/types";
import {
    getDefaultPlatformForRegion,
    getRegionForPlatform,
} from "@/lib/riot";

const DEFAULT_GAME: RiotGame = "league-of-legends";
const VALID_GAMES = new Set<RiotGame>(RIOT_GAMES);

type PersistedAccount = Omit<Account, "games" | "platform" | "region"> &
    Partial<Pick<Account, "games" | "platform" | "region">> & {
    game?: RiotGame;
};

type PersistedAccountEntry = [string, PersistedAccount];

function normalizeGames(
    games?: RiotGame[],
    legacyGame?: RiotGame,
): RiotGame[] {
    const nextGames = (games ?? [legacyGame ?? DEFAULT_GAME]).filter(
        (game): game is RiotGame => VALID_GAMES.has(game),
    );

    return nextGames.length > 0 ? Array.from(new Set(nextGames)) : [DEFAULT_GAME];
}

function normalizeAccount(account: PersistedAccount): Account {
    const platform =
        account.platform ?? getDefaultPlatformForRegion(account.region ?? "EUROPE");
    const region = account.region ?? getRegionForPlatform(platform);

    return {
        ...account,
        games: normalizeGames(account.games, account.game),
        platform,
        region,
    };
}

export async function loadStoredAccounts(): Promise<Map<string, Account>> {
    const entries = await invoke<PersistedAccountEntry[]>("load_accounts_storage");

    return new Map(
        (entries ?? []).map(([userName, account]) => [
            userName,
            normalizeAccount(account),
        ]),
    );
}

export async function saveStoredAccounts(
    accounts: Map<string, Account>,
): Promise<void> {
    await invoke("save_accounts_storage", {
        accounts: Array.from(accounts.entries()),
    });
}
