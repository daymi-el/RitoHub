import type {Account} from "@/lib/types";

interface AccountsProviderType {
    isLoaded: boolean;
    accounts: Map<string, Account>;
    accountsList: Account[];
    addAccount: (account: Account) => void;
    removeAccount: (userName: string) => void;
    updateAccount: (userName: string, updates: Partial<Account>) => void;
    getAccountByUsername: (userName: string) => Account | undefined;
    getAccountByPuuid: (puuid: string) => Account | undefined;
}

export type {AccountsProviderType};
