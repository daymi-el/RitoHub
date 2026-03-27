import {createContext, useContext} from "react";
import type {AccountsProviderType} from "@/providers/types";

export const AccountsContext = createContext<AccountsProviderType | undefined>(
    undefined,
);

export function useAccounts(): AccountsProviderType {
    const context = useContext(AccountsContext);

    if (!context) {
        throw new Error("useAccounts must be used inside AccountsProvider");
    }

    return context;
}
