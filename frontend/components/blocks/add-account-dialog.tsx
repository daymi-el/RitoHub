"use client";

import {useState} from "react";
import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import * as z from "zod";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,} from "@/components/ui/form";
import {Tooltip, TooltipContent, TooltipTrigger,} from "@/components/ui/tooltip";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {Plus, Upload} from "lucide-react";
import {useAccounts} from "@/providers/accounts-provider";
import {useRequests} from "@/hooks/use-requests";
import {Account} from "@/lib/types";

const singleFormSchema = z.object({
    riotID: z
        .string()
        .min(3, "Riot ID is required")
        .regex(/^.+#.+$/, "Format must be GameName#TAG"),
    username: z.string().min(3, "Username must be at least 3 characters"),
    password: z.string().min(1, "Password is required"),
});

const bulkFormSchema = z.object({
    accountsText: z
        .string()
        .min(1, "Please enter at least one account")
        .refine((val) => val
            .split("\n")
            .filter((line) => line.trim())
            .every((line) => /^.+?--.+?#.+?--.+$/.test(line.trim())), "Each line must follow format: username--gamename#tag--password"),
});

type SingleFormValues = z.infer<typeof singleFormSchema>;
type BulkFormValues = z.infer<typeof bulkFormSchema>;

interface ImportResult {
    username: string;
    success: boolean;
    error?: string;
}

export function AddAccountDialog() {
    const [open, setOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [importResults, setImportResults] = useState<ImportResult[]>([]);

    const {addAccount, accounts} = useAccounts();
    const {getRiotAccount, getLeagueAccountData} = useRequests();

    const singleForm = useForm<SingleFormValues>({
        resolver: zodResolver(singleFormSchema), defaultValues: {
            riotID: "", username: "", password: "",
        },
    });

    const bulkForm = useForm<BulkFormValues>({
        resolver: zodResolver(bulkFormSchema), defaultValues: {
            accountsText: "",
        },
    });

    const processAccount = async (username: string, gameName: string, tagLine: string, password: string): Promise<Account> => {
        if (accounts.has(username)) {
            throw new Error("Account already exists");
        }

        const riotData = await getRiotAccount(gameName, tagLine);
        const leagueData = await getLeagueAccountData(riotData.puuid);

        return {
            tagLine, gameName, userName: username, riotData, password, leagueData,
        };
    };

    const onSingleSubmit = async (values: SingleFormValues) => {
        setError(null);

        try {
            const [gameName, tagLine] = values.riotID.split("#");
            const newAccount = await processAccount(values.username, gameName, tagLine, values.password);

            addAccount(newAccount);
            singleForm.reset();
            setOpen(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to add account");
        }
    };

    const onBulkSubmit = async (values: BulkFormValues) => {
        setError(null);
        setImportResults([]);

        const lines = values.accountsText
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line);

        const results: ImportResult[] = [];

        for (const line of lines) {
            const [username, riotID, password] = line.split("--");
            const [gameName, tagLine] = riotID.split("#");

            try {
                const newAccount = await processAccount(username, gameName, tagLine, password);
                addAccount(newAccount);
                results.push({username, success: true});
            } catch (err) {
                results.push({
                    username, success: false, error: err instanceof Error ? err.message : "Unknown error",
                });
            }
        }

        setImportResults(results);

        const allSuccess = results.every((r) => r.success);
        if (allSuccess) {
            bulkForm.reset();
            setTimeout(() => {
                setOpen(false);
                setImportResults([]);
            }, 2000);
        }
    };

    const handleOpenChange = (isOpen: boolean) => {
        setOpen(isOpen);
        if (!isOpen) {
            setError(null);
            setImportResults([]);
        }
    };

    return (<Tooltip>
        <TooltipTrigger asChild>
            <Dialog open={open} onOpenChange={handleOpenChange}>
                <DialogTrigger asChild>
                    <Button variant="outline" size="icon-lg">
                        <Plus/>
                    </Button>
                </DialogTrigger>

                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Add Account</DialogTitle>
                        <DialogDescription>
                            Add accounts to your League manager
                        </DialogDescription>
                    </DialogHeader>

                    <Tabs defaultValue="single" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="single">
                                <Plus className="w-4 h-4 mr-2"/>
                                Single
                            </TabsTrigger>
                            <TabsTrigger value="bulk">
                                <Upload className="w-4 h-4 mr-2"/>
                                Bulk Import
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="single" className="mt-4">
                            <Form {...singleForm}>
                                <form
                                    onSubmit={singleForm.handleSubmit(onSingleSubmit)}
                                    className="space-y-4"
                                >
                                    <FormField
                                        control={singleForm.control}
                                        name="riotID"
                                        render={({field}) => (<FormItem>
                                            <FormLabel>Riot ID</FormLabel>
                                            <FormControl>
                                                <Input placeholder="GameName#TAG" {...field} />
                                            </FormControl>
                                            <FormMessage/>
                                        </FormItem>)}
                                    />

                                    <FormField
                                        control={singleForm.control}
                                        name="username"
                                        render={({field}) => (<FormItem>
                                            <FormLabel>Username</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="Account username"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage/>
                                        </FormItem>)}
                                    />

                                    <FormField
                                        control={singleForm.control}
                                        name="password"
                                        render={({field}) => (<FormItem>
                                            <FormLabel>Password</FormLabel>
                                            <FormControl>
                                                <Input type="password" {...field} />
                                            </FormControl>
                                            <FormMessage/>
                                        </FormItem>)}
                                    />

                                    {error && (<p className="text-sm text-red-500">{error}</p>)}

                                    <DialogFooter>
                                        <DialogClose asChild>
                                            <Button variant="outline" type="button">
                                                Cancel
                                            </Button>
                                        </DialogClose>
                                        <Button
                                            type="submit"
                                            disabled={singleForm.formState.isSubmitting}
                                        >
                                            {singleForm.formState.isSubmitting ? "Adding..." : "Add Account"}
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </Form>
                        </TabsContent>

                        <TabsContent value="bulk" className="mt-4">
                            <Form {...bulkForm}>
                                <form
                                    onSubmit={bulkForm.handleSubmit(onBulkSubmit)}
                                    className="space-y-4"
                                >
                                    <FormField
                                        control={bulkForm.control}
                                        name="accountsText"
                                        render={({field}) => (<FormItem>
                                            <FormLabel>Account List</FormLabel>
                                            <FormControl>
                                                <Textarea
                                                    placeholder={`username--gamename#tag--password
user1--Player1#EUW--mypass123
user2--Player2#NA1--secret456`}
                                                    className="min-h-[200px] font-mono text-sm"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormDescription>
                                                One account per line. Format:
                                                username--gamename#tag--password
                                            </FormDescription>
                                            <FormMessage/>
                                        </FormItem>)}
                                    />

                                    {importResults.length > 0 && (<div
                                        className="space-y-2 max-h-[150px] overflow-y-auto rounded-md border p-3">
                                        {importResults.map((result, idx) => (<div
                                            key={idx}
                                            className={`text-sm flex items-center gap-2 ${result.success ? "text-green-600" : "text-red-600"}`}
                                        >
                            <span className="font-mono">
                              {result.success ? "✓" : "✗"}
                            </span>
                                            <span className="font-medium">
                              {result.username}
                            </span>
                                            {result.error && (<span className="text-xs">- {result.error}</span>)}
                                        </div>))}
                                    </div>)}

                                    <DialogFooter>
                                        <DialogClose asChild>
                                            <Button variant="outline" type="button">
                                                Cancel
                                            </Button>
                                        </DialogClose>
                                        <Button
                                            type="submit"
                                            disabled={bulkForm.formState.isSubmitting}
                                        >
                                            {bulkForm.formState.isSubmitting ? "Importing..." : "Import Accounts"}
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </Form>
                        </TabsContent>
                    </Tabs>
                </DialogContent>
            </Dialog>
        </TooltipTrigger>
        <TooltipContent>
            <p>Add Account</p>
        </TooltipContent>
    </Tooltip>);
}