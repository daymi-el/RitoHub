"use client";

import {useAccounts} from "@/providers/accounts-provider";
import {AccountCard} from "@/components/blocks/account-card";
import {AddAccountDialog} from "@/components/blocks/add-account-dialog";

export default function Home() {
    const {accounts} = useAccounts();

    const hasAccounts = accounts.size > 0;

    return (
        <div className="min-h-screen flex flex-col">
            <header
                className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="flex h-14 items-center justify-between px-4">
                    <h1 className="text-lg font-semibold">
                        League Account Manager
                    </h1>
                    <AddAccountDialog/>
                </div>
            </header>

            <main className="flex-1">
                {hasAccounts ? (
                    <div className="px-4">
                        <div
                            className="py-6 gap-4"
                            style={{
                                display: "grid",
                                gridTemplateColumns:
                                    "repeat(auto-fit, minmax(280px, 400px))",
                            }}
                        >
                            {[...accounts.values()].map((acc) => (
                                <AccountCard key={acc.userName} account={acc}/>
                            ))}
                        </div>
                    </div>
                ) : (
                    <EmptyState/>
                )}
            </main>
        </div>
    );
}

function EmptyState() {
    return (
        <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-4">
            <div className="space-y-2">
                <h2 className="text-2xl font-semibold tracking-tight">
                    No Accounts Yet
                </h2>
                <p className="text-muted-foreground max-w-md">
                    Get started by adding your first League of Legends account
                    using the button above.
                </p>
            </div>
            <AddAccountDialog/>
        </div>
    );
}