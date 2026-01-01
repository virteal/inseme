import React, { useState } from "react";
import { 
  Music, 
  Gamepad2, 
  MessageSquare, 
  Mic, 
  Heart,
  Search,
  ChevronRight,
  Plus
} from "lucide-react";
import { 
  Card, 
  Button, 
  Input,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent
} from "@inseme/ui";

/**
 * ClientMiniApp - Mode "Scan & Play"
 * Interface ultra-rapide optimisée mobile (3 taps max).
 */
export default function ClientMiniApp() {
  const [activeTab, setActiveTab] = useState("music");
  const [votes, setVotes] = useState({ 1: 12, 2: 8 });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      {/* Header compact */}
      <header className="p-4 flex items-center justify-between border-b border-white/5 bg-slate-900/40 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <span className="text-xs font-bold text-slate-950">CY</span>
          </div>
          <h1 className="font-bold text-lg tracking-tight">Cyrnea Bar</h1>
        </div>
        <Badge variant="outline" className="text-[10px] text-slate-500 border-white/10">Table 4 • Intérieur</Badge>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-6">
        <Tabs defaultValue="music" className="w-full" onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3 bg-slate-900/50 p-1 rounded-2xl border border-white/5 mb-6">
            <TabsTrigger value="music" className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950 rounded-xl py-2">
              <Music className="w-4 h-4 mr-2" /> Musique
            </TabsTrigger>
            <TabsTrigger value="games" className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950 rounded-xl py-2">
              <Gamepad2 className="w-4 h-4 mr-2" /> Jeux
            </TabsTrigger>
            <TabsTrigger value="ophelia" className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950 rounded-xl py-2">
              <MessageSquare className="w-4 h-4 mr-2" /> Ophélia
            </TabsTrigger>
          </TabsList>

          <TabsContent value="music" className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-widest px-1">Votez pour la suite</h2>
            <div className="space-y-3">
              {[
                { id: 1, title: "L'Orchestra", artist: "Canta u Populu Corsu", votes: 12 },
                { id: 2, title: "Get Lucky", artist: "Daft Punk", votes: 8 },
                { id: 3, title: "L'Ultimu Cantu", artist: "I Muvrini", votes: 5 }
              ].map((m) => (
                <div key={m.id} className="p-4 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between active:scale-[0.98] transition-transform">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-800 rounded-lg flex items-center justify-center text-slate-500">
                      <Music className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-200 leading-tight">{m.title}</p>
                      <p className="text-xs text-slate-500">{m.artist}</p>
                    </div>
                  </div>
                  <Button variant="ghost" className="flex flex-col items-center p-2 rounded-xl border border-transparent hover:border-amber-500/30">
                    <Heart className={`w-5 h-5 ${m.votes > 10 ? 'fill-amber-500 text-amber-500' : 'text-slate-500'}`} />
                    <span className="text-[10px] mt-1 font-bold text-slate-400">{m.votes}</span>
                  </Button>
                </div>
              ))}
              <Button variant="ghost" className="w-full border-dashed border-white/10 text-slate-500 rounded-2xl py-6">
                <Plus className="w-4 h-4 mr-2" /> Proposer un morceau
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="games" className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-widest px-1">Parties en cours</h2>
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-gradient-to-br from-indigo-500/10 to-indigo-600/5 border-indigo-500/20 p-4 rounded-2xl text-center">
                <p className="text-xs text-indigo-400 font-bold uppercase mb-2">Échecs</p>
                <p className="text-xl font-bold text-slate-200">2 Tables</p>
                <Button size="sm" className="mt-4 bg-indigo-500 hover:bg-indigo-600 text-white w-full rounded-xl">Rejoindre</Button>
              </Card>
              <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20 p-4 rounded-2xl text-center">
                <p className="text-xs text-amber-400 font-bold uppercase mb-2">Cartes</p>
                <p className="text-xl font-bold text-slate-200">1 Table</p>
                <Button size="sm" className="mt-4 bg-amber-500 hover:bg-amber-600 text-slate-950 w-full rounded-xl font-bold">Lancer défi</Button>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="ophelia" className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            <div className="bg-slate-900/50 p-6 rounded-3xl border border-white/5 text-center space-y-4">
              <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto border border-amber-500/30 animate-pulse">
                <Mic className="w-8 h-8 text-amber-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-200">Ophélia est à l'écoute</h3>
                <p className="text-sm text-slate-500 mt-1">Posez votre question ou racontez une anecdote sur le bar.</p>
              </div>
              <div className="flex gap-2">
                <Input placeholder="Tapez ici..." className="bg-slate-950/80 border-slate-800 rounded-2xl" />
                <Button className="bg-amber-500 text-slate-950 rounded-2xl shadow-lg shadow-amber-500/20">Envoyer</Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer minimaliste */}
      <footer className="p-6 bg-slate-950 text-center">
        <p className="text-[10px] text-slate-600 uppercase tracking-widest">Inseme • Cyrnea MVP v1.0</p>
      </footer>
    </div>
  );
}
