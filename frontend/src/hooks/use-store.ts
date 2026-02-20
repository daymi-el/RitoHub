import {LazyStore} from "@tauri-apps/plugin-store";
import type {Account} from "@/lib/types";

export const useStore = () => {
    const store = new LazyStore("accounts.json");

    async function saveAccounts(accounts: Map<string, Account>) {
        const accountsArray = Array.from(accounts.entries());
        await store.set("accounts", accountsArray);
        await store.save();
    }

    async function saveAccount(account: Account) {
        const storage = (await loadAccounts()) ?? new Map<string, Account>();
        storage.set(account.userName, account);
        await saveAccounts(storage);
    }

    async function loadAccounts(): Promise<Map<string, Account> | null> {
        const accountsArray = await store.get<[string, Account][]>(
            "accounts"
        );
        if (!accountsArray) return null;

        return new Map(accountsArray);
    }

    async function clearStorage() {
        await store.clear();
        await store.save();
    }

    return {
        saveAccounts,
        loadAccounts,
        saveAccount,
        clearStorage,
    };
};