import { useState, useEffect, useCallback, useRef } from 'react'

export function useInseme(roomName, user, supabase, config = {}) {
    const [messages, setMessages] = useState([])
    const [roomData, setRoomData] = useState({
        proposition: "Pas de proposition active.",
        results: {},
        votes: {},
        media: null,
        speechQueue: [],
        moderators: []
    })
    const [isOphéliaThinking, setIsOphéliaThinking] = useState(false)
    const [systemPrompt, setSystemPrompt] = useState("")
    const [roomMetadata, setRoomMetadata] = useState(null)
    const timersRef = useRef({})
    const messageCountRef = useRef(0)

    // 1. Fetch Room Metadata & System Prompt
    useEffect(() => {
        if (!roomName || !supabase) return;

        const loadConfig = async () => {
            // Try to find SaaS room metadata
            const { data: room, error } = await supabase
                .from('inseme_rooms')
                .select('*')
                .eq('slug', roomName)
                .maybeSingle();

            if (room) {
                setRoomMetadata(room);
                if (room.settings?.ophelia?.prompt) {
                    setSystemPrompt(room.settings.ophelia.prompt);
                } else {
                    const promptUrl = config.promptUrl || '/prompts/inseme.md';
                    fetch(promptUrl).then(res => res.text()).then(setSystemPrompt);
                }
            } else {
                // Fallback to static prompt file
                const promptUrl = config.promptUrl || '/prompts/inseme.md';
                fetch(promptUrl)
                    .then(res => res.text())
                    .then(setSystemPrompt)
                    .catch(err => console.error("Erreur de chargement du prompt Ophélia:", err))
            }
        };

        loadConfig();
    }, [roomName, supabase, config.promptUrl])

    // 2. Main Subscription & Initial Fetch
    useEffect(() => {
        if (!roomName || !supabase) return

        const fetchMessages = async () => {
            const { data, error } = await supabase
                .from('inseme_messages')
                .select('*')
                .eq('room_id', roomName)
                .order('created_at', { ascending: true })
                .limit(200)

            if (!error) {
                setMessages(data)
                processMessages(data)
                messageCountRef.current = data.length
            }
        }

        fetchMessages()

        const channel = supabase
            .channel(`room:${roomName}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'inseme_messages',
                filter: `room_id=eq.${roomName}`
            }, (payload) => {
                const newMsg = payload.new
                setMessages(prev => [...prev, newMsg])
                processMessage(newMsg)

                // 3. Proactive Trigger: Wake up Ophélia every 10 messages
                messageCountRef.current++
                if (messageCountRef.current % 10 === 0 && newMsg.name !== 'Ophélia') {
                    triggerOphélia()
                }
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
            Object.values(timersRef.current).forEach(clearTimeout)
        }
    }, [roomName, supabase])

    const processMessages = (msgs) => {
        const state = {
            proposition: "Pas de proposition active.",
            results: {},
            votes: {},
            media: null,
            speechQueue: [],
            moderators: []
        }
        msgs.forEach(msg => updateStateWithMsg(state, msg))
        setRoomData(state)
    }

    const processMessage = (msg) => {
        setRoomData(prev => {
            const newState = { ...prev }
            updateStateWithMsg(newState, msg)
            return newState
        })
    }

    const updateStateWithMsg = (state, msg) => {
        const text = msg.message.trim()

        if (msg.metadata?.vocal_payload) {
            playVocalMessage(msg.metadata.vocal_payload)
        }

        if (!text.toLowerCase().startsWith('inseme')) return

        const parts = text.split(/\s+/)
        const command = parts[1]?.toLowerCase()
        const payload = parts.slice(2).join(' ')
        const userId = msg.user_id || msg.name

        if (command === '?') {
            state.proposition = payload || "Proposition vide."
            state.votes = {}
        } else if (command === '!') {
            state.votes = {}
            state.results = {}
            state.proposition = "Pas de proposition active."
        } else if (['live', 'image', 'pad', 'wiki', 'twitter', 'facebook', 'agenda'].includes(command)) {
            if (!payload || payload === 'off' || payload === '-') {
                state.media = null
            } else {
                state.media = { type: command, url: payload }
            }
        } else if (command === 'bye') {
            state.votes[userId] = { type: 'delegate', target: payload, name: msg.name }
        } else if (command === 'parole' || command === 'technical') {
            if (!state.speechQueue.find(s => s.userId === userId)) {
                state.speechQueue.push({ userId, name: msg.name, type: command })
            }
        } else {
            const voteType = command || 'quiet'
            if (voteType === 'quiet' || voteType === 'off') {
                delete state.votes[userId]
            } else {
                state.votes[userId] = {
                    type: voteType,
                    name: msg.name,
                    timestamp: msg.created_at
                }
            }
        }

        const results = {}
        Object.values(state.votes).forEach(v => {
            results[v.type] = (results[v.type] || 0) + 1
        })
        state.results = results
    }

    const playVocalMessage = (base64) => {
        const audio = new Audio(`data:audio/mp3;base64,${base64}`)
        audio.play().catch(e => console.warn("Auto-play bloqué par le navigateur:", e))
    }

    const sendMessage = async (content, metadata = {}) => {
        if (!user && !metadata.is_ai) return
        if (!supabase) return

        const { error } = await supabase.from('inseme_messages').insert({
            room_id: roomName,
            user_id: metadata.is_ai ? null : (user?.id || null),
            name: metadata.is_ai ? 'Ophélia' : (user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Anonyme'),
            message: content,
            metadata: metadata
        })

        if (content.startsWith('inseme parole') || content.startsWith('inseme technical')) {
            const userId = user?.id || 'Anonyme'
            if (timersRef.current[userId]) clearTimeout(timersRef.current[userId])
            timersRef.current[userId] = setTimeout(() => {
                castVote('quiet')
            }, 30000)
        }

        return { error }
    }

    const triggerOphélia = async (userIntent = null) => {
        if (isOphéliaThinking) return
        setIsOphéliaThinking(true)

        try {
            const history = messages.slice(-15).map(m => ({
                role: m.name === 'Ophélia' ? 'assistant' : 'user',
                content: `${m.name}: ${m.message}`
            }))

            if (userIntent) {
                history.push({ role: 'user', content: `Message direct à Ophélia: ${userIntent}` })
            }

            const opheliaUrl = config.opheliaUrl || '/api/ophelia';
            const response = await fetch(opheliaUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'chat',
                    room_id: roomName,
                    content: history,
                    context: roomData,
                    system_prompt: systemPrompt,
                    room_settings: roomMetadata?.settings // Pass SaaS settings (voice override etc)
                })
            })

            const { actions, text } = await response.json()

            if (actions && actions.length > 0) {
                for (const action of actions) {
                    const { tool, args, vocal_payload } = action

                    if (tool === 'send_message') {
                        await sendMessage(args.text, { is_ai: true, vocal_payload })
                    } else if (tool === 'speak') {
                        await sendMessage(args.text, { is_ai: true, vocal_payload, vocal_only: true })
                    } else if (tool === 'set_proposition') {
                        await setProposition(args.text, true)
                    } else if (tool === 'manage_speech_queue') {
                        await sendMessage(`[Médiation] ${args.action === 'invite' ? 'Invitons' : 'Retirons'} ${args.userId} de la liste.`, { is_ai: true })
                    }
                }
            }

            if (text) {
                await sendMessage(text, { is_ai: true })
            }

        } catch (error) {
            console.error("Erreur Agent Ophélia:", error)
        } finally {
            setIsOphéliaThinking(false)
        }
    }

    const castVote = (voteType) => sendMessage(`inseme ${voteType}`)
    const setProposition = (text, isAi = false) => sendMessage(`inseme ? ${text}`, isAi ? { is_ai: true } : {})
    const resetVotes = () => sendMessage(`inseme !`)
    const setMedia = (type, url) => sendMessage(`inseme ${type} ${url}`)

    return {
        messages,
        roomData,
        roomMetadata,
        isOphéliaThinking,
        sendMessage,
        castVote,
        setProposition,
        resetVotes,
        setMedia,
        askOphélia: triggerOphélia
    }
}
