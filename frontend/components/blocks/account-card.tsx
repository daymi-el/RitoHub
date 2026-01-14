"use client";

import {Account} from "@/lib/types";
import {Card, CardContent, CardFooter, CardHeader,} from "@/components/ui/card";
import {Progress} from "@/components/ui/progress";
import {SummonerLeagueDto} from "twisted/dist/models-dto/league";
import {Tooltip, TooltipContent, TooltipTrigger,} from "@/components/ui/tooltip";
import {Badge} from "@/components/ui/badge";
import {Avatar, AvatarImage} from "@/components/ui/avatar";
import {useAccounts} from "@/providers/accounts-provider";
import {Button} from "@/components/ui/button";
import {Trash2, TrendingUp} from "lucide-react";

const APEX_TIERS = ["MASTER", "GRANDMASTER", "CHALLENGER"];

const toTitleCase = (str: string) =>
    str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();

const calculateWinrate = (wins: number, losses: number): number => {
    const total = wins + losses;
    return total > 0 ? Math.round((wins / total) * 100) : 0;
};

interface AccountCardProps {
    account: Account;
}

export function AccountCard({account}: AccountCardProps) {
    const soloDuoData = account.leagueData.find(
        (data) => data.queueType === "RANKED_SOLO_5x5"
    );

    return soloDuoData ? (
        <RankedAccountCard account={account} stats={soloDuoData}/>
    ) : (
        <UnrankedAccountCard account={account}/>
    );
}

interface RankedAccountCardProps {
    account: Account;
    stats: SummonerLeagueDto;
}

function RankedAccountCard({account, stats}: RankedAccountCardProps) {
    const {removeAccount} = useAccounts();

    return (
        <Card className="relative w-full max-w-sm min-w-2xs flex justify-between">
            <DeleteAccountButton
                onDelete={() => removeAccount(account.userName)}
            />
            <AccountCardHeader
                account={account}
                rankImagePath={`/rank-emblems/Rank=${toTitleCase(stats.tier)}.png`}
            />
            <CardContent></CardContent>
            <AccountCardFooter stats={stats}/>
        </Card>
    );
}

interface UnrankedAccountCardProps {
    account: Account;
}

function UnrankedAccountCard({account}: UnrankedAccountCardProps) {
    const {removeAccount} = useAccounts();

    return (
        <Card className="relative w-full max-w-sm min-w-2xs flex justify-between">
            <DeleteAccountButton
                onDelete={() => removeAccount(account.userName)}
            />
            <AccountCardHeader
                account={account}
                rankImagePath="/rank-emblems/Rank=Unranked.png"
            />
            <CardContent>
                <div className="flex flex-row items-center justify-center gap-2 text-muted-foreground">
                    <TrendingUp className="w-8 h-8"/>
                    <p className="text-sm font-medium">No Ranked Data</p>
                </div>
            </CardContent>
            <CardFooter className="flex justify-center">
                <Badge variant="secondary">Unranked</Badge>
            </CardFooter>
        </Card>
    );
}

interface DeleteAccountButtonProps {
    onDelete: () => void;
}

function DeleteAccountButton({onDelete}: DeleteAccountButtonProps) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    className="absolute top-2 right-2 z-10"
                    variant="destructive"
                    size="icon-sm"
                    onClick={onDelete}
                >
                    <Trash2/>
                </Button>
            </TooltipTrigger>
            <TooltipContent>
                <span>Remove Account</span>
            </TooltipContent>
        </Tooltip>
    );
}

interface AccountCardHeaderProps {
    account: Account;
    rankImagePath: string;
}

function AccountCardHeader({
                               account,
                               rankImagePath,
                           }: AccountCardHeaderProps) {
    return (
        <CardHeader className="flex flex-row items-center gap-3">
            <Avatar className="h-16 w-16 rounded-lg">
                <AvatarImage src={rankImagePath} alt=""/>
            </Avatar>
            <h3 className="font-semibold text-lg break-words pr-10">
                {account.gameName}#{account.tagLine}
            </h3>
        </CardHeader>
    );
}

interface AccountCardFooterProps {
    stats: SummonerLeagueDto;
}

function AccountCardFooter({stats}: AccountCardFooterProps) {
    const winrate = calculateWinrate(stats.wins, stats.losses);
    const isApexTier = APEX_TIERS.includes(stats.tier);

    return (
        <CardFooter className="flex flex-col items-start gap-2">
            <div className="flex flex-row w-full justify-between">
                <p className="font-semibold">
                    {stats.tier} {!isApexTier && stats.rank}
                </p>
                <div className="flex justify-end items-center gap-1">
                    <Badge
                        variant="outline"
                        className={winrate >= 50 ? "bg-green-800" : "bg-red-800"}
                    >
                        {winrate}% W/L
                    </Badge>
                </div>
            </div>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Progress value={stats.leaguePoints} max={100}/>
                </TooltipTrigger>
                <TooltipContent>
                    <p className="font-bold">{stats.leaguePoints}LP</p>
                </TooltipContent>
            </Tooltip>
        </CardFooter>
    );
}