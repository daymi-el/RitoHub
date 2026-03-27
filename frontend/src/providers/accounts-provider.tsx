import {
    type ReactNode,
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";
import type {Account} from "@/lib/types";
import type {AccountsProviderType} from "@/providers/types";
import {AccountsContext} from "@/providers/accounts-context";
import {
    loadStoredAccounts,
    saveStoredAccounts,
} from "@/lib/account-store";

interface AccountsProviderProps {
    children: ReactNode;
}

export function AccountsProvider({children}: AccountsProviderProps) {
    const [accounts, setAccounts] = useState<Map<string, Account>>(new Map());
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        let isCurrent = true;

        async function hydrateAccounts() {
            try {
                const storedAccounts = await loadStoredAccounts();

                if (!isCurrent) {
                    return;
                }

                setAccounts(storedAccounts);
            } catch (error) {
                console.error("Failed to load stored accounts", error);
            } finally {
                if (isCurrent) {
                    setIsLoaded(true);
        }
            }
        }

        void hydrateAccounts();

        return () => {
            isCurrent = false;
        };
    }, []);

    useEffect(() => {
        if (!isLoaded) {
            return;
        }

        void saveStoredAccounts(accounts).catch((error) => {
            console.error("Failed to save accounts", error);
        });
    }, [accounts, isLoaded]);

    const accountsList = useMemo(() => Array.from(accounts.values()), [accounts]);

    const accountsByPuuid = useMemo(
        () =>
            new Map(accountsList.map((account) => [account.riotData.puuid, account])),
        [accountsList],
    );

    const addAccount = useCallback((newAccount: Account) => {
        setAccounts((previousAccounts) => {
            if (previousAccounts.has(newAccount.userName)) {
                return previousAccounts;
            }

            const nextAccounts = new Map(previousAccounts);
            nextAccounts.set(newAccount.userName, newAccount);
            return nextAccounts;
        });
    }, []);

    const removeAccount = useCallback((userName: string) => {
        setAccounts((previousAccounts) => {
            if (!previousAccounts.has(userName)) {
                return previousAccounts;
            }

            const nextAccounts = new Map(previousAccounts);
            nextAccounts.delete(userName);
            return nextAccounts;
        });
    }, []);

    const updateAccount = useCallback(
        (userName: string, updates: Partial<Account>) => {
            setAccounts((previousAccounts) => {
                const account = previousAccounts.get(userName);

                if (!account) {
                    return previousAccounts;
                }

                const nextAccounts = new Map(previousAccounts);
                nextAccounts.set(userName, {...account, ...updates});
                return nextAccounts;
            });
        },
        [],
    );

    const getAccountByUsername = useCallback(
        (userName: string) => accounts.get(userName),
        [accounts],
    );

    const getAccountByPuuid = useCallback(
        (puuid: string) => accountsByPuuid.get(puuid),
        [accountsByPuuid],
    );

    const value = useMemo<AccountsProviderType>(
        () => ({
            isLoaded,
            accounts,
            accountsList,
            addAccount,
            removeAccount,
            updateAccount,
            getAccountByUsername,
            getAccountByPuuid,
        }),
        [
            accounts,
            accountsList,
            addAccount,
            getAccountByPuuid,
            getAccountByUsername,
            isLoaded,
            removeAccount,
            updateAccount,
        ],
    );

    return (
        <AccountsContext.Provider value={value}>
            {children}
        </AccountsContext.Provider>
    );
}
