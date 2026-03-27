import type { Platform } from "@zqz979/league-api-wrapper";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Upload } from "lucide-react";
import { useState } from "react";
import {
  useForm,
  type Control,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import * as z from "zod";
import {
  RIOT_GAMES,
  RIOT_GAME_LABELS,
  type Account,
  type RiotGame,
} from "@/lib/types";
import { lookupRiotAccountBundle } from "@/lib/riot-api";
import {
  PLATFORM_OPTIONS,
  SUPPORTED_PLATFORM_VALUES,
  getRegionForPlatform,
} from "@/lib/riot";
import { useAccounts } from "@/providers/accounts-context";
import { Button } from "@/components/ui/button";
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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const singleFormSchema = z.object({
  riotId: z
    .string()
    .min(3, "Riot ID is required")
    .regex(/^.+#.+$/, "Format must be GameName#TAG"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(1, "Password is required"),
  platform: z.enum(SUPPORTED_PLATFORM_VALUES, {
    message: "Please select a platform",
  }),
  games: z.array(z.enum(RIOT_GAMES)).min(1, "Select at least one game"),
});

const bulkFormSchema = z.object({
  accountsText: z
    .string()
    .min(1, "Please enter at least one account")
    .refine(
      (value) =>
        value
          .split("\n")
          .filter((line) => line.trim())
          .every((line) => /^.+?--.+?#.+?--.+$/.test(line.trim())),
      "Each line must follow format: username--gamename#tag--password",
    ),
  platform: z.enum(SUPPORTED_PLATFORM_VALUES, {
    message: "Please select a platform",
  }),
  games: z.array(z.enum(RIOT_GAMES)).min(1, "Select at least one game"),
});

type SingleFormValues = z.infer<typeof singleFormSchema>;
type BulkFormValues = z.infer<typeof bulkFormSchema>;

interface ImportResult {
  username: string;
  success: boolean;
  error?: string;
}

interface ParsedRiotId {
  gameName: string;
  tagLine: string;
}

interface ParsedBulkLine extends ParsedRiotId {
  username: string;
  password: string;
}

interface BuildAccountParams extends ParsedBulkLine {
  platform: Platform;
  games: RiotGame[];
  existingUsernames: ReadonlySet<string>;
}

function parseRiotId(riotId: string): ParsedRiotId {
  const [gameName, tagLine] = riotId.split("#");

  return {
    gameName: gameName.trim(),
    tagLine: tagLine.trim(),
  };
}

function parseBulkLine(line: string): ParsedBulkLine {
  const [username, riotId, password] = line
    .split("--")
    .map((value) => value.trim());
  const { gameName, tagLine } = parseRiotId(riotId);

  return {
    username,
    gameName,
    tagLine,
    password,
  };
}

async function buildAccount({
  username,
  gameName,
  tagLine,
  password,
  platform,
  games,
  existingUsernames,
}: BuildAccountParams): Promise<Account> {
  if (existingUsernames.has(username)) {
    throw new Error("Account already exists");
  }

  const { riotData, leagueData } = await lookupRiotAccountBundle(
    gameName,
    tagLine,
    platform,
  );

  return {
    games,
    gameName,
    tagLine,
    userName: username,
    password,
    platform,
    region: getRegionForPlatform(platform),
    riotData,
    leagueData,
  };
}

interface PlatformSelectFieldProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
}

function PlatformSelectField<TFieldValues extends FieldValues>({
  control,
  name,
}: PlatformSelectFieldProps<TFieldValues>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>Platform</FormLabel>
          <Select onValueChange={field.onChange} defaultValue={field.value}>
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder="Select a platform" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {PLATFORM_OPTIONS.map((platform) => (
                <SelectItem key={platform.value} value={platform.value}>
                  {platform.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormDescription>
            Pick the account&apos;s server platform.
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function toggleGameTag(currentGames: RiotGame[], game: RiotGame): RiotGame[] {
  return currentGames.includes(game)
    ? currentGames.filter((entry) => entry !== game)
    : [...currentGames, game];
}

interface GameTagsFieldProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
}

function GameTagsField<TFieldValues extends FieldValues>({
  control,
  name,
}: GameTagsFieldProps<TFieldValues>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const selectedGames = (field.value ?? []) as RiotGame[];

        return (
          <FormItem>
            <FormLabel>Games</FormLabel>
            <FormControl>
              <div className="flex flex-wrap gap-2">
                {RIOT_GAMES.map((game) => (
                  <Button
                    key={game}
                    type="button"
                    size="sm"
                    variant={
                      selectedGames.includes(game) ? "default" : "outline"
                    }
                    onClick={() =>
                      field.onChange(toggleGameTag(selectedGames, game))
                    }
                  >
                    {RIOT_GAME_LABELS[game]}
                  </Button>
                ))}
              </div>
            </FormControl>
            <FormDescription>
              Tag the account with every Riot game it should appear under.
            </FormDescription>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}

function ImportResultsList({ results }: { results: ImportResult[] }) {
  if (results.length === 0) {
    return null;
  }

  return (
    <div className="max-h-[150px] space-y-2 overflow-y-auto rounded-md border p-3">
      {results.map((result, index) => (
        <div
          key={`${result.username}-${index}`}
          className={`flex items-center gap-2 text-sm ${
            result.success ? "text-green-600" : "text-red-600"
          }`}
        >
          <span className="font-mono">{result.success ? "OK" : "ERR"}</span>
          <span className="font-medium">{result.username}</span>
          {result.error && <span className="text-xs">- {result.error}</span>}
        </div>
      ))}
    </div>
  );
}

interface AddAccountDialogProps {
  trigger?: React.ReactNode;
}

export function AddAccountDialog({ trigger }: AddAccountDialogProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);

  const { addAccount, accounts } = useAccounts();

  const singleForm = useForm<SingleFormValues>({
    resolver: zodResolver(singleFormSchema),
    defaultValues: {
      riotId: "",
      username: "",
      password: "",
      platform: "EUW1",
      games: ["league-of-legends"],
    },
  });

  const bulkForm = useForm<BulkFormValues>({
    resolver: zodResolver(bulkFormSchema),
    defaultValues: {
      accountsText: "",
      platform: "EUW1",
      games: ["league-of-legends"],
    },
  });

  function resetState() {
    setError(null);
    setImportResults([]);
    singleForm.reset();
    bulkForm.reset();
  }

  async function onSingleSubmit(values: SingleFormValues) {
    setError(null);

    try {
      const { gameName, tagLine } = parseRiotId(values.riotId);
      const newAccount = await buildAccount({
        username: values.username,
        gameName,
        tagLine,
        password: values.password,
        platform: values.platform,
        games: values.games,
        existingUsernames: new Set(accounts.keys()),
      });

      addAccount(newAccount);
      singleForm.reset();
      setOpen(false);
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Failed to add account",
      );
    }
  }

  async function onBulkSubmit(values: BulkFormValues) {
    setError(null);
    setImportResults([]);

    const lines = values.accountsText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const knownUsernames = new Set(accounts.keys());
    const results: ImportResult[] = [];

    for (const line of lines) {
      const parsedLine = parseBulkLine(line);

      try {
        const newAccount = await buildAccount({
          ...parsedLine,
          platform: values.platform,
          games: values.games,
          existingUsernames: knownUsernames,
        });

        addAccount(newAccount);
        knownUsernames.add(parsedLine.username);
        results.push({ username: parsedLine.username, success: true });
      } catch (nextError) {
        results.push({
          username: parsedLine.username,
          success: false,
          error:
            nextError instanceof Error ? nextError.message : "Unknown error",
        });
      }
    }

    setImportResults(results);

    if (results.every((result) => result.success)) {
      bulkForm.reset();
      setOpen(false);
      setImportResults([]);
    }
  }

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);

    if (!isOpen) {
      resetState();
    }
  }

  const defaultTrigger = (
    <Button variant="outline" size="icon-lg">
      <Plus />
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? defaultTrigger}
      </DialogTrigger>

          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add Account</DialogTitle>
              <DialogDescription>
                Add an account and tag which Riot games it belongs to.
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="single" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="single">
                  <Plus className="mr-2 h-4 w-4" />
                  Single
                </TabsTrigger>
                <TabsTrigger value="bulk">
                  <Upload className="mr-2 h-4 w-4" />
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
                      name="riotId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Riot ID</FormLabel>
                          <FormControl>
                            <Input placeholder="GameName#TAG" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={singleForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <Input placeholder="Account username" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={singleForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input type="password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <PlatformSelectField
                      control={singleForm.control}
                      name="platform"
                    />
                    <GameTagsField control={singleForm.control} name="games" />

                    {error && <p className="text-sm text-red-500">{error}</p>}

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
                        {singleForm.formState.isSubmitting
                          ? "Adding..."
                          : "Add Account"}
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
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Account List</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder={`username--gamename#tag--password\nuser1--Player1#EUW--mypass123\nuser2--Player2#NA1--secret456`}
                              className="min-h-[200px] font-mono text-sm"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            One account per line. Format:
                            username--gamename#tag--password
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <PlatformSelectField
                      control={bulkForm.control}
                      name="platform"
                    />
                    <GameTagsField control={bulkForm.control} name="games" />

                    <ImportResultsList results={importResults} />

                    {error && <p className="text-sm text-red-500">{error}</p>}

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
                        {bulkForm.formState.isSubmitting
                          ? "Importing..."
                          : "Import Accounts"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
  );
}
