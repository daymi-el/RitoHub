import {createFileRoute, Link} from '@tanstack/react-router'
import {Button} from "@/components/ui/button.tsx";
import {ChevronLeft} from "lucide-react"
import {LoginAccountButton} from "@/components/blocks/account-card.tsx";
import {useAccounts} from "@/providers/accounts-provider.tsx";
import {useEffect, useState} from "react";
import type {Account} from "@/lib/types.ts";
import {useRequests} from "@/hooks/use-requests.ts";
import type {MatchDto} from "@zqz979/league-api-wrapper";
import {Card, CardContent, CardHeader} from "@/components/ui/card.tsx";
import {cn} from "@/lib/utils.ts";

export const Route = createFileRoute('/lol/summoners/$puuid/overview/')({
    component: RouteComponent,
})

function RouteComponent() {
    const {puuid} = Route.useParams()
    const {getAccountByPUUID} = useAccounts();
    const {getMatchHistoryByPUUID} = useRequests();

    const [account, setAccount] = useState<Account>()
    const [matchHistory, setMatchHistory] = useState<MatchDto[]>([])

    useEffect(() => {
        if (!puuid) return;

        setAccount(getAccountByPUUID(puuid));
    }, []);

    useEffect(() => {
        if (!account) return;

        async function loadMatchHistory() {
            const history = await getMatchHistoryByPUUID({region: account!.region, puuid: account!.riotData.puuid, count: 20})
            setMatchHistory(history);
        }

        loadMatchHistory()
    }, [account]);

    if (!account) return <NoAccountFoundScreen/>

    return (
        <div className="min-h-screen flex flex-col">
            <header
                className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
                <div className="flex h-14 items-center justify-between px-4">
                    <Link to={"/"}>
                        <Button size={"icon-lg"} variant={"ghost"}>
                            <ChevronLeft/>
                        </Button>
                    </Link>
                    <h1 className="text-lg font-semibold">
                        {account.gameName}#{account.tagLine}
                    </h1>

                    <LoginAccountButton onLogin={() => console.log("Log into Account")}/>
                </div>
            </header>

            <main className="flex-1 flex flex-col gap-6 items-center p-2">
                {matchHistory.map((match) => {
                    const participant = match.info.participants.find(
                        (acc) => acc.puuid === puuid
                    )!;

                    return (
                        <Card
                            key={match.metadata.matchId}
                            className={cn(
                                "w-full max-w-5xl",
                                participant.win ? "bg-green-900" : "bg-red-900"
                            )}
                        >
                            <CardHeader>
                                {match.info.queueId === 420 ? "RANKED SOLO/DUO" : ""}
                            </CardHeader>
                            <CardContent>
                                <h1>{participant.win ? "WIN" : "LOSE"}</h1>
                            </CardContent>
                        </Card>
                    );
                })}
            </main>
        </div>
    )
}

function NoAccountFoundScreen() {
    return (
        <div className="min-h-screen flex flex-col">
            <header
                className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
                <div className="flex h-14 items-center justify-between px-4">
                    <Link to={"/"}>
                        <Button size={"icon-lg"} variant={"ghost"}>
                            <ChevronLeft/>
                        </Button>
                    </Link>
                    <h1 className="text-lg font-semibold">
                        NO ACCOUNT FOUND
                    </h1>

                    <div></div>
                </div>
            </header>

            <main className="flex-1">

            </main>
        </div>
    )
}