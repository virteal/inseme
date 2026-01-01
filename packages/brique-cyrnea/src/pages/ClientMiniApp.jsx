import React, { useState } from "react";
import { 
  Music, 
  Gamepad2, 
  MessageSquare, 
  Mic, 
  Heart,
  Plus
} from "lucide-react";
import { 
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Button
} from "@inseme/ui";
import { InsemeRoom } from "@inseme/core";

/**
 * ClientMiniApp - Mode "Scan & Play"
 * Refactorisé pour intégrer InsemeRoom au sein des onglets.
 */
export default function ClientMiniApp({ roomId = "cyrnea-general" }) {
  const [activeTab, setActiveTab] = useState("music");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col overflow-hidden">
      {/* Header compact */}
      <header className="p-4 flex items-center justify-between border-b border-white/5 bg-slate-900/40 backdrop-blur-md z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <span className="text-xs font-bold text-slate-950">CY</span>
          </div>
          <h1 className="font-bold text-lg tracking-tight">Cyrnea Bar</h1>
        </div>
        <Badge variant="outline" className="text-[10px] text-slate-500 border-white/10 uppercase tracking-tighter">Table 4</Badge>
      </header>

      <main className="flex-1 overflow-hidden flex flex-col p-4">
        <Tabs defaultValue="music" className="w-full flex-1 flex flex-col" onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3 bg-slate-900/50 p-1 rounded-2xl border border-white/5 mb-6 flex-shrink-0">
            <TabsTrigger value="music" className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950 rounded-xl py-2">
              <Music className="w-4 h-4 mr-2" /> Musique
            </TabsTrigger>
            <TabsTrigger value="games" className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950 rounded-xl py-2">
              <Gamepad2 className="w-4 h-4 mr-2" /> Jeux
            </TabsTrigger>
            <TabsTrigger value="ophelia" className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950 rounded-xl py-2">
              <Mic className="w-4 h-4 mr-2" /> Ophélia
            </TabsTrigger>
          </TabsList>

          <TabsContent value="music" className="flex-1 overflow-y-auto space-y-4 animate-in fade-in">
             {/* Playlist UI (déjà implémentée avant) */}
             <div className="space-y-3">
              {[
                { id: 1, title: "L'Orchestra", artist: "Canta u Populu Corsu", votes: 12 },
                { id: 2, title: "Get Lucky", artist: "Daft Punk", votes: 8 },
              ].map((m) => (
                <div key={m.id} className="p-4 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-200">{m.title}</p>
                    <p className="text-xs text-slate-500">{m.artist}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="flex flex-col gap-1 h-auto py-2">
                    <Heart className="w-4 h-4 text-emerald-500" />
                    <span className="text-[10px] text-slate-400">{m.votes}</span>
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="games" className="flex-1 overflow-y-auto space-y-4 animate-in fade-in">
             <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-900/50 p-4 rounded-2xl border border-white/5 text-center">
                   <p className="text-xs font-bold text-amber-500 mb-2 uppercase">Échecs</p>
                   <Button variant="outline" className="w-full rounded-xl">Rejoindre</Button>
                </div>
                <div className="bg-slate-900/50 p-4 rounded-2xl border border-white/5 text-center">
                   <p className="text-xs font-bold text-amber-500 mb-2 uppercase">Cartes</p>
                   <Button variant="outline" className="w-full rounded-xl">Défier</Button>
                </div>
             </div>
          </TabsContent>

          <TabsContent value="ophelia" className="flex-1 flex flex-col animate-in fade-in h-0">
             {/* Intégration directe de la vocal assembly Inseme */}
             <div className="flex-1 bg-slate-950/80 rounded-3xl border border-white/5 overflow-hidden flex flex-col relative">
                <InsemeRoom 
                  roomName={roomId} 
                  variant="minimal" 
                  hideHeader 
                  hideFooter={false}
                />
             </div>
          </TabsContent>
        </Tabs>
      </main>

      <footer className="p-4 bg-slate-950 text-center opacity-30">
        <p className="text-[8px] uppercase tracking-widest">Powered by Inseme Core</p>
      </footer>
    </div>
  );
}
