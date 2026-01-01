import React, { useState, useEffect } from "react";
import { 
  Users, 
  Music, 
  MessageSquare, 
  Trophy, 
  Play, 
  SkipForward, 
  CheckCircle,
  Zap,
  Coffee
} from "lucide-react";
import { 
  Card, 
  Button, 
  Badge, 
  Progress,
  Avatar
} from "@inseme/ui";
import { getDynamicConfig, useCurrentUser } from "@inseme/cop-host";

/**
 * BarmanDashboard - Mode "Henry & Jean-Marie"
 * Interface minimaliste pour piloter l'ambiance sans interrompre le service.
 */
export default function BarmanDashboard() {
  const [vibeScore, setVibeScore] = useState(85);
  const [iaSuggestions, setIaSuggestions] = useState([
    { id: 1, type: "music", content: "Passer un morceau plus calme (Folk/Jazz) pour l'ambiance intérieure.", priority: "high" },
    { id: 2, type: "game", content: "Valider le défi échecs de la Table 4.", priority: "medium" }
  ]);
  const [pendingRewards, setPendingRewards] = useState([
    { id: 101, user: "Mattea", reward: "Café offert (Gagnante Mots Croisés)", table: "Terasse" }
  ]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
            Cyrnea Dashboard
          </h1>
          <p className="text-slate-400">Mode Barman — Henry & Jean-Marie</p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
            ● Live
          </Badge>
          <Avatar className="w-10 h-10 border-2 border-amber-500/50" src="/images/barman-avatar.png" fallback="H" />
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Colonne 1: Ambiance & Musique */}
        <div className="space-y-6">
          <Card className="bg-slate-900/50 border-slate-800 p-6 backdrop-blur-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" /> Score d'Ambiance
              </h2>
              <span className="text-2xl font-bold text-amber-400">{vibeScore}%</span>
            </div>
            <Progress value={vibeScore} className="h-2 bg-slate-800" indicatorClassName="bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
            <p className="text-sm text-slate-400 mt-4 italic">
              "L'ambiance est conviviale, légère tendance festive à l'extérieur."
            </p>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800 p-6 backdrop-blur-sm">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Music className="w-5 h-5 text-blue-400" /> Contrôle Musique
            </h2>
            <div className="bg-slate-950/50 rounded-lg p-4 mb-4 border border-slate-800/50">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">En cours</p>
              <p className="font-medium text-slate-200">I Muvrini - Terra</p>
            </div>
            <div className="flex gap-4">
              <Button variant="outline" size="lg" className="flex-1 border-slate-700 hover:bg-slate-800 text-slate-300">
                <Play className="w-5 h-5 mr-2" /> Pause
              </Button>
              <Button variant="outline" size="lg" className="flex-1 border-slate-700 hover:bg-slate-800 text-slate-300">
                <SkipForward className="w-5 h-5 mr-2" /> Suivant
              </Button>
            </div>
          </Card>
        </div>

        {/* Colonne 2: Suggestions IA */}
        <div className="space-y-6">
          <Card className="bg-slate-900/50 border-slate-800 p-6 backdrop-blur-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <MessageSquare className="w-24 h-24" />
            </div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-purple-400" /> Suggestions Ophélia
            </h2>
            <div className="space-y-3">
              {iaSuggestions.map(s => (
                <div key={s.id} className="p-3 rounded-lg bg-slate-950/50 border border-slate-800/50 hover:border-slate-700 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className={`mt-1 h-2 w-2 rounded-full ${s.priority === 'high' ? 'bg-red-500' : 'bg-amber-500'}`} />
                    <p className="text-sm text-slate-300">{s.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Colonne 3: Validations & Récompenses */}
        <div className="space-y-6">
          <Card className="bg-slate-900/50 border-slate-800 p-6 backdrop-blur-sm">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-orange-400" /> Validations En Cours
            </h2>
            <div className="space-y-4">
              {pendingRewards.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">Aucune validation en attente.</p>
              ) : (
                pendingRewards.map(r => (
                  <div key={r.id} className="p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-600/5 border border-amber-500/20 shadow-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <Coffee className="w-4 h-4 text-amber-500" />
                        <span className="font-semibold text-slate-200">{r.user}</span>
                      </div>
                      <Badge className="bg-amber-900/30 text-amber-400 border-amber-800/50">{r.table}</Badge>
                    </div>
                    <p className="text-sm text-slate-400 mb-4">{r.reward}</p>
                    <Button className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold tracking-tight py-2 shadow-lg shadow-amber-500/20">
                      <CheckCircle className="w-4 h-4 mr-2" /> Valider
                    </Button>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
