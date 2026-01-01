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
  Coffee,
  Mic
} from "lucide-react";
import { 
  Card, 
  Button, 
  Badge, 
  Progress,
  Avatar
} from "@inseme/ui";
import { useInseme } from "@inseme/core";

/**
 * BarmanDashboard - Mode "Henry & Jean-Marie"
 * Refactorisé pour intégrer le coeur Inseme (Chat/Vocal)
 */
export default function BarmanDashboard({ roomId = "cyrnea-general" }) {
  const { messages, activeSpeakers, sendMessage } = useInseme({ roomId });
  const [vibeScore, setVibeScore] = useState(85);
  
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
          <div className="flex items-center gap-2 bg-slate-900 px-3 py-1 rounded-full border border-white/5">
             <Mic className="w-4 h-4 text-emerald-500 animate-pulse" />
             <span className="text-xs font-medium text-slate-300">{activeSpeakers.length} Actifs</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ambiance & Musique */}
        <div className="space-y-6">
          <Card className="bg-slate-900/50 border-slate-800 p-6 backdrop-blur-sm">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" /> Ambiance
            </h2>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-slate-400">Vibe Score</span>
              <span className="text-xl font-bold text-amber-400">{vibeScore}%</span>
            </div>
            <Progress value={vibeScore} className="h-2 bg-slate-800" />
          </Card>

          <Card className="bg-slate-900/50 border-slate-800 p-6 backdrop-blur-sm">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Music className="w-5 h-5 text-blue-400" /> Playlist
            </h2>
            <div className="bg-slate-950/50 rounded-lg p-4 mb-4 border border-slate-800/50">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">En cours</p>
              <p className="font-medium text-slate-200">I Muvrini - Terra</p>
            </div>
            <Button className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300">
               <SkipForward className="w-4 h-4 mr-2" /> Passer au suivant
            </Button>
          </Card>
        </div>

        {/* Live Fed - Macagna & Chat */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-slate-900/50 border-slate-800 p-6 backdrop-blur-sm h-[500px] flex flex-col">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-purple-400" /> Live Macagna & Chat
            </h2>
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
              {messages.slice(-20).map(msg => (
                <div key={msg.id} className={`flex gap-3 ${msg.type === 'ai' ? 'bg-amber-500/5 p-3 rounded-xl border border-amber-500/10' : ''}`}>
                  <div className="w-8 h-8 rounded-full bg-slate-800 flex-shrink-0 flex items-center justify-center text-xs font-bold">
                    {msg.sender?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-slate-300">{msg.sender}</span>
                      <span className="text-[10px] text-slate-500">{new Date(msg.created_at).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-sm text-slate-400 leading-relaxed">{msg.text}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-white/5 flex gap-2">
               <input 
                 className="flex-1 bg-slate-950 border-slate-800 rounded-lg px-4 py-2 text-sm" 
                 placeholder="Message rapide (staff)..." 
                 onKeyPress={(e) => {
                   if (e.key === 'Enter') {
                     sendMessage(e.target.value);
                     e.target.value = '';
                   }
                 }}
               />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
