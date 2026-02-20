import {createContext, type ReactNode, useContext, useEffect, useState,} from "react";
import type {AccountsProviderType} from "@/providers/types";
import type {Account} from "@/lib/types";
import {useStore} from "@/hooks/use-store";

const AccountsContext = createContext<AccountsProviderType | undefined>(
    undefined
);

interface AccountsProviderProps {
    children: ReactNode;
}

export function AccountsProvider({children}: AccountsProviderProps) {
    const {loadAccounts, saveAccounts} = useStore();
    const [accounts, setAccounts] = useState<Map<string, Account>>(new Map());
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        async function init() {
            const stored = await loadAccounts();
            if (stored) {
                setAccounts(stored);
            }
            setIsLoaded(true);
        }

        init();
    }, []);

    useEffect(() => {
        if (isLoaded) {
            saveAccounts(accounts);
        }
    }, [accounts, isLoaded]);

    function addAccount(newAccount: Account) {
        setAccounts((prevState) => {
            const next = new Map(prevState);
            if (next.has(newAccount.userName)) {
                console.warn("Account already exists");
                return prevState;
            }
            next.set(newAccount.userName, newAccount);
            return next;
        });
    }

    function removeAccount(userName: string) {
        setAccounts((prevState) => {
            const next = new Map(prevState);
            next.delete(userName);
            return next;
        });
    }

    function updateAccount(userName: string, updates: Partial<Account>) {
        setAccounts((prevState) => {
            const next = new Map(prevState);
            const account = next.get(userName);

            if (!account) {
                console.warn("Account not found!");
                return prevState;
            }

            next.set(userName, {...account, ...updates});
            return next;
        });
    }

    function getAccountByUsername(userName: string): Account | undefined {
        return accounts.get(userName);
    }

    function getAccountByPUUID(puuid: string): Account | undefined {
        return Array.from(accounts.values()).find((acc) => acc.riotData.puuid === puuid)
    }

    return (
        <AccountsContext.Provider
            value={{
                accounts,
                addAccount,
                removeAccount,
                updateAccount,
                getAccountByPUUID,
                getAccountByUsername,
            }}
        >
            {children}
        </AccountsContext.Provider>
    );
}

export const useAccounts = () => {
    const context = useContext(AccountsContext);
    if (!context) {
        throw new Error("useAccounts must be used inside AccountsProvider");
    }
    return context;
};