import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Send, Bot, Loader2, Volume2, VolumeX, Mic, MicOff, Download, Globe, Printer, Cloud, Link as LinkIcon, Users, Play, Square, Clock, ShieldCheck, X, BarChart3, CheckCircle2, Eye } from 'lucide-react';
import { useInsemeContext } from '../InsemeContext';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { AgendaPanel } from './AgendaPanel';
import { MobileControls } from './MobileControls';

export function Chat(props) {
    const context = useInsemeContext();

    const { 
        roomName, user, messages, sendMessage, askOphélia, isOphéliaThinking, isSilent, 
        setIsSilent, roomMetadata, archiveReport, roomData, startSession, endSession, 
        updateAgenda, castVote, onParole, onDelegate, sessions, currentSessionId, 
        selectSession, uploadVocal, playVocal, systemPrompt,
        onToggleBoard, isBoardOpen // Added from props
    } = { ...context, ...props };

    const [newMessage, setNewMessage] = useState('');
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [showSessions, setShowSessions] = useState(false);
    const [showConstitution, setShowConstitution] = useState(false);
    const [copied, setCopied] = useState(false);
    const scrollRef = useRef(null);

    const handleShare = () => {
        const url = window.location.href;
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // ... handleTranscription and handleSend remain the same ...

    const handleTranscription = async (blob) => {
        setIsTranscribing(true);
        try {
            // 1. Upload to Supabase Storage (reliable temporary storage)
            // Improved naming for TTL protection (room_id included)
            const safeRoomName = (roomMetadata?.id || roomName || 'unknown').replace(/[^a-z0-9]/gi, '_');
            const fileName = `temp/${safeRoomName}_${Date.now()}_${Math.random().toString(36).substring(7)}.webm`;
            const vocalUrl = await uploadVocal(blob, fileName);

            // 2. Transcribe using the blob (fastest, still using OpenAI API)
            const formData = new FormData();
            formData.append('file', blob, 'audio.webm');

            const response = await fetch('/api/transcribe', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            if (data.text) {
                // 3. Send message with text + pointer to audio in storage
                await sendMessage(data.text, { 
                    type: 'transcription',
                    metadata: {
                        vocal_url: vocalUrl,
                        type: 'vocal_transcription'
                    }
                });
            }
        } catch (err) {
            console.error("Erreur de transcription:", err);
        } finally {
            setIsTranscribing(false);
        }
    };

    const { isRecording, startRecording, stopRecording } = useVoiceRecorder(handleTranscription);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        // Simple URL Detection for metadata enrichment
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const urls = newMessage.match(urlRegex);

        await sendMessage(newMessage, urls ? { type: 'link', urls } : {});
        setNewMessage('');
    };

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    return (
        <div className="flex flex-col h-[600px] bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden relative">
            {/* Session Selector Dropdown */}
            {showSessions && (
                <div className="absolute top-16 left-6 z-50 w-64 bg-[#0f0f12] border border-white/10 rounded-2xl shadow-2xl p-4 animate-in fade-in slide-in-from-top-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xs font-black text-white uppercase tracking-widest">Sessions Découvertes</h3>
                        <button onClick={() => selectSession(null)} className="text-[10px] text-indigo-400 font-bold hover:underline">RETOUR AU DIRECT</button>
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                        {sessions.length === 0 && <p className="text-[10px] text-white/20 text-center py-4">Aucune session archivée</p>}
                        {sessions.map(s => (
                            <button
                                key={s.id}
                                onClick={() => {
                                    selectSession(s);
                                    setShowSessions(false);
                                }}
                                className={`w-full text-left p-3 rounded-xl border transition-all group ${currentSessionId === s.id ? 'bg-indigo-500/20 border-indigo-500/30' : 'bg-white/5 border-white/5 hover:border-white/10'}`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className={`text-[10px] font-black uppercase tracking-tighter ${currentSessionId === s.id ? 'text-indigo-300' : 'text-white/40'}`}>
                                        {new Date(s.start).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                                    </span>
                                    <span className="text-[9px] text-white/20 font-mono">{s.count} msgs</span>
                                </div>
                                <p className="text-[11px] font-bold text-white/80 line-clamp-2 leading-snug group-hover:text-white transition-colors">
                                    {s.title}
                                </p>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Constitution Modal */}
            {showConstitution && (
                <div className="absolute inset-0 z-[100] bg-[#0f0f12]/95 backdrop-blur-xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-6 border-b border-white/10 flex items-center justify-between bg-indigo-500/5">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-indigo-500/20">
                                <ShieldCheck className="w-5 h-5 text-indigo-400" />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-white uppercase tracking-widest">Constitution d'Ophélia</h3>
                                <p className="text-[10px] text-white/40 font-bold uppercase tracking-tighter">Règles de médiation & éthique de l'IA</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => setShowConstitution(false)}
                            className="p-2 hover:bg-white/10 rounded-xl transition-colors text-white/60 hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                        <div className="max-w-2xl mx-auto">
                            <div className="prose prose-invert prose-sm prose-p:text-white/70 prose-headings:text-indigo-300 prose-strong:text-indigo-200 bg-white/5 p-8 rounded-3xl border border-white/10 shadow-inner">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {systemPrompt || "# Chargement...\nLa constitution n'est pas encore disponible."}
                                </ReactMarkdown>
                            </div>
                            <div className="mt-8 p-6 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex gap-4 items-start">
                                <Bot className="w-5 h-5 text-indigo-400 mt-1 shrink-0" />
                                <p className="text-xs text-indigo-200/80 leading-relaxed italic">
                                    "Cette constitution définit mes règles d'engagement. Je ne peux pas être influencée pour favoriser un participant au détriment d'un autre. Ma mission est la recherche du consensus et la clarté du débat."
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {isOphéliaThinking && (
                <div className="absolute inset-x-0 top-16 z-20 bg-indigo-500/10 border-b border-indigo-500/20 backdrop-blur-sm px-6 py-2 flex items-center gap-3 animate-pulse">
                    <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                    <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">Ophélia analyse les débats en temps réel...</span>
                </div>
            )}

            {/* Chat Header */}
            <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-white/5 relative z-10">
                <div className="flex flex-col">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        {roomMetadata?.name || roomName || 'Discussion'}
                        {roomMetadata?.settings?.parent_slug && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] uppercase font-bold tracking-widest border border-amber-500/30">
                                Commission
                            </span>
                        )}
                    </h2>
                    <p className="text-[10px] text-white/30 uppercase tracking-tighter">
                        {roomMetadata?.settings?.parent_slug
                            ? `Sous-groupe de ${roomMetadata.settings.parent_slug}`
                            : (roomMetadata?.description || 'Échanges & Médiation')
                        }
                    </p>
                </div>

                {/* Session Status & Presence */}
                <div className="flex items-center gap-4 mr-auto ml-4 hidden lg:flex">
                    {/* Session Selector Button */}
                    <button
                        onClick={() => setShowSessions(!showSessions)}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[9px] uppercase font-black tracking-widest border transition-all ${currentSessionId ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' : 'bg-white/5 text-white/40 border-white/10'}`}
                    >
                        <Clock className="w-3 h-3" />
                        {currentSessionId ? 'Replay' : 'Direct'}
                    </button>

                    <div className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-widest text-white/40 bg-white/5 px-2 py-1 rounded-full">
                        <Users className="w-3 h-3" />
                        {roomData?.connectedUsers?.length || 1}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Share Button */}
                    <button
                        onClick={handleShare}
                        className={`p-2 rounded-lg transition-all border flex items-center gap-2 ${copied ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-white/5 text-white/40 border-white/10 hover:text-white'}`}
                        title="Partager le lien de la salle"
                    >
                        {copied ? <CheckCircle2 className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />}
                        {copied && <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:inline">Lien copié</span>}
                    </button>

                    {/* Board Toggle Button */}
                    <button
                        onClick={onToggleBoard}
                        className={`p-2 rounded-lg transition-all border ${isBoardOpen ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' : 'bg-white/5 text-white/40 border-white/10 hover:text-white'}`}
                        title={isBoardOpen ? "Masquer le tableau" : "Afficher le tableau"}
                    >
                        <BarChart3 className="w-4 h-4" />
                    </button>

                    <button
                        onClick={() => setShowConstitution(true)}
                        className="p-2 rounded-lg transition-all bg-white/5 text-white/40 hover:text-indigo-400 group relative hidden sm:flex"
                        title="Voir la Constitution d'Ophélia"
                    >
                        <ShieldCheck className="w-4 h-4" />
                        <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-neutral-900 text-[9px] font-bold text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-white/10 uppercase tracking-widest">Constitution</span>
                    </button>
                    <button
                        onClick={() => setIsSilent(!isSilent)}
                        className={`p-2 rounded-lg transition-all ${isSilent ? 'bg-red-500/20 text-red-400' : 'bg-white/5 text-white/40 hover:text-white/60'}`}
                        title={isSilent ? "Activer l'audio" : "Mode Silencieux"}
                    >
                        {isSilent ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                    <button
                        onClick={() => askOphélia()}
                        disabled={isOphéliaThinking}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 text-xs font-bold transition-all border border-indigo-500/30 disabled:opacity-50 group"
                    >
                        <Bot className="w-4 h-4 group-hover:scale-110 transition-transform" />
                        <span className="hidden md:inline">DEMANDER À OPHÉLIA</span>
                    </button>
                </div>
            </div>

            {/* Agenda Panel (Collapsible) */}
    <AgendaPanel agenda={roomData?.agenda || []} updateAgenda={updateAgenda} />

    {/* History Overlay */ }
    {
        showHistory && (
            <div className="absolute inset-0 z-30 bg-neutral-900/95 backdrop-blur-xl p-6 overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-white flex items-center gap-3">
                        <Clock className="w-5 h-5 text-indigo-400" />
                        Historique des Séances
                    </h3>
                    <button onClick={() => setShowHistory(false)} className="text-white/40 hover:text-white uppercase text-[10px] font-bold tracking-widest">Fermer</button>
                </div>
                <div className="space-y-4">
                    {messages.filter(m => m.metadata?.type === 'report').reverse().map((report, i) => (
                        <div key={report.id || i} className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-indigo-500/30 transition-all group">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex flex-col">
                                    <span className="text-indigo-300 font-bold text-sm">Séance du {new Date(report.created_at).toLocaleDateString()}</span>
                                    <span className="text-white/20 text-xs">Clôture à {new Date(report.created_at).toLocaleTimeString()}</span>
                                </div>
                                <div className="flex gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                    {/* We could reuse download/print logic here if refactored, for now simplified */}
                                    <button className="px-3 py-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 text-xs font-bold hover:bg-indigo-500/30">
                                        Voir le PV
                                    </button>
                                </div>
                            </div>
                            <div className="text-white/40 text-xs line-clamp-3 font-mono">
                                {report.message.substring(0, 200)}...
                            </div>
                        </div>
                    ))}
                    {messages.filter(m => m.metadata?.type === 'report').length === 0 && (
                        <div className="text-center text-white/20 italic py-10">Aucun procès-verbal archivé pour le moment.</div>
                    )}
                </div>
            </div>
        )
    }

    {/* Messages Area */ }
    <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth"
    >
        {messages?.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-white/20 space-y-4">
                <Bot className="w-12 h-12 opacity-10" />
                <div className="text-center">
                    <p>Aucun message pour le moment.</p>
                    <p className="text-xs">Ophélia écoute et attend le début du débat.</p>
                </div>
            </div>
        ) : (
            messages?.map((msg, i) => {
                if (msg.message.toLowerCase().startsWith('inseme')) return null;
                if (msg.metadata?.vocal_only) return null; // Only play audio

                const isAI = msg.name === 'Ophélia';
                const isTranscription = msg.metadata?.type === 'transcription' || msg.metadata?.type === 'vocal_transcription';
                const isLink = msg.metadata?.type === 'link';
                const isReport = msg.metadata?.type === 'report';
                const isPoll = msg.metadata?.type === 'flash_poll';
                const hasAudio = !!msg.metadata?.vocal_payload || !!msg.metadata?.vocal_url;

                // Translation State
                const [showOriginal, setShowOriginal] = useState(false);
                const [translatedContent, setTranslatedContent] = useState(null);
                const isTranslated = !!msg.metadata?.original;
                const originalLang = msg.metadata?.lang?.toUpperCase();

                const handleTranslateToNative = async () => {
                    if (translatedContent) {
                        setTranslatedContent(null); // Toggle off
                        return;
                    }
                    try {
                        const res = await fetch('/api/translate', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ text: msg.message, target_lang: localStorage.getItem('inseme_native_lang') || 'fr' })
                        });
                        const data = await res.json();
                        if (data.translated_text) setTranslatedContent(data.translated_text);
                    } catch (e) {
                        console.error("Translation error", e);
                    }
                };

                const displayMessage = showOriginal ? msg.metadata.original : (translatedContent || msg.message);

                const downloadReport = () => {
                    const blob = new Blob([msg.message], { type: 'text/markdown' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `PV_Seance_${new Date().toISOString().slice(0, 10)}.md`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                };

                const printReport = () => {
                    const printWindow = window.open('', '_blank');
                    const dateStr = new Date().toLocaleDateString('fr-FR', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                    });
                    
                    printWindow.document.write(`
                        <html>
                            <head>
                                <title>Procès-Verbal - Inseme</title>
                                <style>
                                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
                                    body { 
                                        font-family: 'Inter', -apple-system, sans-serif; 
                                        padding: 80px; 
                                        max-width: 850px; 
                                        margin: 0 auto; 
                                        line-height: 1.6; 
                                        color: #1a1a1a; 
                                        background: white;
                                    }
                                    .header { 
                                        display: flex; 
                                        justify-content: space-between; 
                                        align-items: flex-start;
                                        margin-bottom: 60px; 
                                        border-bottom: 2px solid #1a1a1a;
                                        padding-bottom: 20px;
                                    }
                                    .logo { font-weight: 900; letter-spacing: -1px; font-size: 24px; color: #000; text-transform: uppercase; }
                                    .date { font-size: 12px; color: #444; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }
                                    
                                    h1 { 
                                        font-size: 28px; 
                                        font-weight: 900; 
                                        margin-bottom: 10px; 
                                        color: #000;
                                        letter-spacing: 0.05em;
                                        text-transform: uppercase;
                                        text-align: center;
                                    }
                                    .subtitle { 
                                        color: #666; 
                                        margin-bottom: 40px; 
                                        font-size: 13px; 
                                        text-transform: uppercase; 
                                        letter-spacing: 2px;
                                        text-align: center;
                                        font-weight: 700;
                                    }
                                    
                                    .content { 
                                        font-size: 15px;
                                        color: #333;
                                    }
                                    .content h1, .content h2, .content h3 {
                                        color: #000;
                                        margin-top: 2em;
                                        border-bottom: 1px solid #eee;
                                        padding-bottom: 0.5em;
                                    }
                                    .content h1 { font-size: 20px; text-transform: uppercase; }
                                    .content h2 { font-size: 18px; }
                                    .content h3 { font-size: 16px; border-bottom: none; }
                                    
                                    .footer {
                                        margin-top: 100px;
                                        padding-top: 40px;
                                        border-top: 1px solid #eee;
                                        display: flex;
                                        justify-content: space-between;
                                    }
                                    .signature-box {
                                        width: 200px;
                                        height: 100px;
                                        border: 1px dashed #ccc;
                                        margin-top: 10px;
                                        display: flex;
                                        align-items: center;
                                        justify-content: center;
                                        font-size: 10px;
                                        color: #999;
                                        text-transform: uppercase;
                                    }
                                    .stamp {
                                        border: 3px double #1a1a1a;
                                        padding: 10px 20px;
                                        font-weight: 900;
                                        text-transform: uppercase;
                                        transform: rotate(-3deg);
                                        display: inline-block;
                                        margin-top: 20px;
                                    }
                                    @media print {
                                        body { padding: 0; }
                                        button { display: none; }
                                    }
                                </style>
                            </head>
                            <body>
                                <div class="header">
                                    <div class="logo">INSEME</div>
                                    <div class="date">${dateStr}</div>
                                </div>
                                
                                <h1>Procès-Verbal de Séance</h1>
                                <div class="subtitle">Espace : ${roomName}</div>
                                
                                <div class="metadata-box">
                                    <strong>ID de Session :</strong> ${msg.id || 'N/A'}<br/>
                                    <strong>Organisme :</strong> Assemblée Numérique Inseme<br/>
                                    <strong>Généré par :</strong> Ophélia (IA Médiatrice certifiée)
                                </div>
                                
                                <div class="content">
                                    ${msg.message
                                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                        .replace(/### (.*?)\n/g, '<h3>$1</h3>')
                                        .replace(/## (.*?)\n/g, '<h2>$1</h2>')
                                        .replace(/- (.*?)\n/g, '<li>$1</li>')
                                        .replace(/\n/g, '<br/>')
                                    }
                                </div>
                                
                                <div class="signature">
                                    <div>
                                        <strong>Attestation de conformité</strong><br/>
                                        <span style="font-size: 12px; color: #666;">Ce document constitue un enregistrement fidèle des débats.</span>
                                    </div>
                                    <div class="stamp">CERTIFIÉ PAR OPHÉLIA</div>
                                </div>
                                
                                <script>
                                    window.onload = function() { window.print(); }
                                </script>
                            </body>
                        </html>
                    `);
                    printWindow.document.close();
                };

                const handleArchive = async () => {
                    try {
                        const dateStr = new Date().toISOString().slice(0, 10);
                        const url = await archiveReport(msg.message, dateStr);
                        alert(`Archivé avec succès !\nURL: ${url}`);
                    } catch (e) {
                        alert(`Erreur d'archivage : ${e.message}`);
                    }
                };

                return (
                    <div key={msg.id || i} className={`flex flex-col group ${isAI ? 'items-start' : 'items-start'}`}>
                        <div className="flex items-baseline gap-2 mb-1.5 px-1">
                            <span className={`text-[10px] font-black uppercase tracking-widest ${isAI ? 'text-indigo-400 font-bold' : 'text-white/30'}`}>
                                {msg.name}
                            </span>
                            <span className="text-[9px] text-white/10 font-medium">
                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {isTranscription && (
                                <span className="text-[8px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded uppercase font-bold tracking-tighter">Vocal</span>
                            )}
                            {isReport && (
                                <span className="text-[8px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded uppercase font-bold tracking-tighter">Officiel</span>
                            )}
                            {isTranslated && (
                                <button
                                    onClick={() => setShowOriginal(!showOriginal)}
                                    className="flex items-center gap-1 text-[8px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded uppercase font-bold tracking-tighter hover:bg-blue-500/30 transition-colors"
                                >
                                    <Globe className="w-2 h-2" />
                                    {showOriginal ? 'Original' : `Traduit de ${originalLang}`}
                                </button>
                            )}
                            {/* Generic Translate Button */}
                            {!isTranslated && !isReport && (
                                <button
                                    onClick={handleTranslateToNative}
                                    className={`opacity-0 group-hover:opacity-100 transition-opacity text-[8px] px-1.5 py-0.5 rounded uppercase font-bold tracking-tighter flex items-center gap-1 ${translatedContent ? 'bg-indigo-500 text-white' : 'text-white/20 hover:text-white/60'}`}
                                    title="Traduire dans ma langue"
                                >
                                    <Globe className="w-2 h-2" />
                                    {translatedContent ? 'Voir Original' : 'Traduire'}
                                </button>
                            )}
                            {hasAudio && (
                                <button
                                    onClick={() => playVocal(msg.metadata?.vocal_payload || msg.metadata?.vocal_url)}
                                    className="p-1 hover:bg-white/10 rounded-full transition-colors group/play"
                                    title="Réécouter le message vocal"
                                >
                                    <Volume2 className="w-3 h-3 text-indigo-500 animate-pulse group-hover/play:scale-125 transition-transform" />
                                </button>
                            )}
                            {isTranscription && (
                                <span className="text-[8px] px-1 py-0.5 rounded bg-white/5 text-white/40 uppercase font-black tracking-tighter flex items-center gap-1">
                                    <Mic className="w-2 h-2" />
                                    Transcription
                                </span>
                            )}
                        </div>
                        <div className={`px-4 py-3 rounded-2xl max-w-[92%] transition-all shadow-sm ${isAI
                            ? 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-50 text-sm leading-relaxed'
                            : 'bg-white/5 text-white/80 border border-white/5 text-sm leading-relaxed group-hover:bg-white/[0.07]'} ${isReport ? 'border-emerald-500/30 bg-emerald-900/10' : ''}`}>

                            {isReport && (
                                <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10">
                                    <span className="text-xs font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-2">
                                        <Bot className="w-3 h-3" />
                                        Procès-Verbal
                                    </span>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleArchive}
                                            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/60 hover:text-white"
                                            title={`Archiver dans le Cloud (${roomMetadata?.settings?.storage_bucket || 'public-documents'})`}
                                        >
                                            <Cloud className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={printReport}
                                            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/60 hover:text-white"
                                            title="Imprimer (PDF)"
                                        >
                                            <Printer className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={downloadReport}
                                            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/60 hover:text-white"
                                            title="Télécharger le PV (Markdown)"
                                        >
                                            <Download className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="prose prose-invert prose-sm max-w-none prose-p:my-0 prose-headings:text-indigo-300 prose-a:text-indigo-400">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {displayMessage}
                                </ReactMarkdown>
                            </div>

                            {isPoll && (
                                <div className="mt-4 p-4 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                                    <div className="flex items-center gap-2 text-indigo-400 mb-2">
                                        <BarChart3 className="w-4 h-4" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Sondage Express</span>
                                    </div>
                                    <div className="space-y-3">
                                        {['pour', 'contre', 'abstention'].map(option => {
                                            const count = messages.filter(m => m.type === 'vote' && m.metadata?.option === option).length;
                                            const total = messages.filter(m => m.type === 'vote').length || 1;
                                            const percentage = Math.round((count / total) * 100);
                                            const hasVoted = messages.some(m => m.type === 'vote' && m.user_id === user?.id);

                                            return (
                                                <div key={option} className="space-y-1">
                                                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-tighter">
                                                        <span className={option === 'pour' ? 'text-emerald-400' : option === 'contre' ? 'text-red-400' : 'text-white/40'}>
                                                            {option}
                                                        </span>
                                                        <span className="text-white/20">{count} voix ({percentage}%)</span>
                                                    </div>
                                                    <button
                                                        disabled={!user || hasVoted}
                                                        onClick={() => castVote(option)}
                                                        className="w-full h-8 rounded-lg bg-white/5 border border-white/5 relative overflow-hidden group/opt hover:border-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        <div 
                                                            className={`absolute inset-y-0 left-0 transition-all duration-1000 ${option === 'pour' ? 'bg-emerald-500/20' : option === 'contre' ? 'bg-red-500/20' : 'bg-white/10'}`}
                                                            style={{ width: `${percentage}%` }}
                                                        />
                                                        <div className="absolute inset-0 flex items-center justify-center">
                                                            {hasVoted && messages.find(m => m.type === 'vote' && m.user_id === user?.id)?.metadata?.option === option && (
                                                                <CheckCircle2 className="w-3 h-3 text-indigo-400 animate-in zoom-in" />
                                                            )}
                                                        </div>
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="text-[9px] text-white/20 text-center italic">
                                        Cliquez sur une barre pour exprimer votre position
                                    </div>
                                </div>
                            )}
                            {isLink && msg.metadata?.urls && (
                                <div className="mt-3 space-y-2">
                                    {msg.metadata.urls.map((url, idx) => (
                                        <a
                                            key={idx}
                                            href={url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="block p-2 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 transition-all text-xs text-indigo-300 truncate"
                                        >
                                            🔗 {url.replace(/^https?:\/\//, '')}
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                );
            })
        )}
    </div>

    {/* Input Area - Distinction between Spectator and Guest */}
    {user ? (
        <form onSubmit={handleSend} className="p-4 bg-neutral-900/50 backdrop-blur-xl border-t border-white/10 flex gap-3 relative z-10">
            <div className="relative flex-1 group">
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={user.is_anonymous ? "Participez en tant qu'invité..." : "Participez au débat..."}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3.5 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all group-hover:border-white/20"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    {isTranscribing ? (
                        <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                    ) : (
                        <button
                            type="button"
                            onMouseDown={startRecording}
                            onMouseUp={stopRecording}
                            onTouchStart={startRecording}
                            onTouchEnd={stopRecording}
                            className={`p-2 rounded-full transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'text-white/20 hover:text-white/40'}`}
                            title="Maintenir pour parler"
                        >
                            <Mic className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>
            <button
                type="submit"
                className="aspect-square flex items-center justify-center bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl transition-all shadow-lg shadow-indigo-500/20 active:scale-95 px-4"
            >
                <Send className="w-5 h-5" />
            </button>
        </form>
    ) : (
        <div className="p-6 bg-neutral-900/50 backdrop-blur-xl border-t border-white/10 text-center relative z-10 flex flex-col items-center gap-3">
            <div className="flex items-center gap-2 text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">
                <Eye className="w-3 h-3" />
                Mode Spectateur (Lecture Seule)
            </div>
            <button 
                onClick={() => window.dispatchEvent(new CustomEvent('inseme-open-auth'))}
                className="px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-xs font-bold text-white transition-all active:scale-95"
            >
                Rejoindre la discussion
            </button>
        </div>
    )}

    {/* Mobile Controls Overlay */}
    {user && (
        <MobileControls
            onParole={onParole}
            onVote={castVote}
            onDelegate={onDelegate}
            onToggleMic={isRecording ? stopRecording : startRecording}
            isRecording={isRecording}
            sessionStatus={roomData?.sessionStatus}
        />
    )}
        </div>
    );
}
