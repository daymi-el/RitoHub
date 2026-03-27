import type {ParticipantDto, Platform} from "@zqz979/league-api-wrapper";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import {TeamList} from "./team-list";
import {PlayerStatPanel} from "./player-stat-panel";

export function MatchRowDetail({
                                   allies,
                                   opponents,
                                   participant,
                                   currentPuuid,
                                   platform,
                               }: {
    allies: ParticipantDto[];
    opponents: ParticipantDto[];
    participant: ParticipantDto;
    currentPuuid: string;
    platform?: Platform;
}) {
    return (
        <div className="border-t px-4 py-3">
            <Tabs defaultValue="teams">
                <TabsList>
                    <TabsTrigger value="teams">Teams</TabsTrigger>
                    <TabsTrigger value="stats">Stats</TabsTrigger>
                </TabsList>

                <TabsContent value="teams">
                    <div className="grid gap-4 md:grid-cols-2">
                        <TeamList
                            label="Allies"
                            participants={allies}
                            currentPuuid={currentPuuid}
                            platform={platform}
                        />
                        <TeamList
                            label="Opponents"
                            participants={opponents}
                            platform={platform}
                        />
                    </div>
                </TabsContent>

                <TabsContent value="stats">
                    <PlayerStatPanel participant={participant}/>
                </TabsContent>
            </Tabs>
        </div>
    );
}
