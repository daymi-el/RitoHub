import type {Account} from "@/lib/types";

interface AccountsProviderType {
    accounts: Map<string, Account>;
    addAccount: (account: Account) => void;
    removeAccount: (userName: string) => void;
    updateAccount: (userName: string, updates: Partial<Account>) => void;
    getAccountByUsername: (userName: string) => Account | undefined;
    getAccountByPUUID: (puuid: string) => Account | undefined;
}

export type {AccountsProviderType}