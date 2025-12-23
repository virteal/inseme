import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const OpenAIKey = Deno.env.get("OPENAI_API_KEY");

export default async (request, context) => {
    // Handle CORS
    if (request.method === "OPTIONS") {
        return new Response("ok", {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type",
            },
        });
    }

    try {
        const { action, room_id, content, context: room_context, system_prompt, room_settings } = await request.json();

        if (action === "chat") {
            let finalSystemPrompt = system_prompt || "Tu es Ophélia, médiatrice d'Inseme.";

            // --- SESSION CONTINUITY: Checkpoint Strategy ---
            // Fetch the LAST report (PV) from the SAME room to act as historical context.
            const supabaseUrl = Deno.env.get("SUPABASE_URL");
            const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY");
            if (supabaseUrl && supabaseKey) {
                const supabase = createClient(supabaseUrl, supabaseKey);

                const { data: lastReports } = await supabase
                    .from('inseme_messages')
                    .select('message, created_at')
                    .eq('room_id', room_id) // Same room
                    .contains('metadata', { type: 'report' })
                    .order('created_at', { ascending: false })
                    .limit(1);

                if (lastReports && lastReports.length > 0) {
                    const pv = lastReports[0].message;
                    finalSystemPrompt += `\n\n### CONTEXTE HISTORIQUE (SÉANCE PRÉCÉDENTE)\nCette session fait suite à des débats précédents. Voici le dernier Procès-Verbal généré :\n\n${pv}\n\nUtilise ce contexte pour assurer la continuité des débats sans te répéter.`;
                }
            }

            // --- SESSION STATUS ENFORCEMENT ---
            // --- SESSION STATUS CONTEXT (LIQUID DEMOCRACY) ---
            if (room_context?.sessionStatus === 'closed') {
                finalSystemPrompt += `\n\nℹ️ ÉTAT ACTUEL : SÉANCE CLOSE.\nCependant, les rôles sont flexibles. Si un participant agit comme si la séance était ouverte (ex: vote, proposition), NE BLOQUE PAS. Fais simplement remarquer gentiment l'incohérence : "Je note cette action, mais la séance est techniquement close. Considérez-vous qu'elle est rouverte ?"`;
            } else if (room_context?.sessionStatus === 'open') {
                finalSystemPrompt += `\n\n✅ ÉTAT ACTUEL : SÉANCE OUVERTE.`;
            }

            finalSystemPrompt += `\n\n### PHILOSOPHIE DE MÉDIATION (LIQUID ROLES)\nTu n'es pas la police. Tu es une facilitatrice.\n- Les participants s'attribuent eux-mêmes les rôles (Président, etc.).\n- Si deux personnes se contredisent sur le statut (l'un ouvre, l'autre ferme), demande une clarification ("Qui préside ?").\n- Laisse les humains s'auto-organiser. Ton but est de rendre les débats TRAÇABLES et COHÉRENTS, pas de les forcer.`;

            const messages = [
                {
                    role: "system",
                    content: `${finalSystemPrompt}\n\nContexte Actuel de la Salle (${room_id}) :\n${JSON.stringify(room_context, null, 2)}`
                },
                ...content.map(m => ({ role: m.role || "user", content: m.text || m.content }))
            ];

            const tools = [
                {
                    type: "function",
                    function: {
                        name: "send_message",
                        description: "Envoyer un message textuel à l'assemblée.",
                        parameters: {
                            type: "object",
                            properties: {
                                text: { type: "string", description: "Le contenu du message." },
                                vocal_only: { type: "boolean", description: "Si vrai, le message ne sera que vocal (TTS)." }
                            },
                            required: ["text"]
                        }
                    }
                },
                {
                    type: "function",
                    function: {
                        name: "speak",
                        description: "Prendre la parole vocalement (TTS).",
                        parameters: {
                            type: "object",
                            properties: {
                                text: { type: "string", description: "Le texte à prononcer." }
                            },
                            required: ["text"]
                        }
                    }
                },
                {
                    type: "function",
                    function: {
                        name: "set_proposition",
                        description: "Figer une proposition concrète pour le vote.",
                        parameters: {
                            type: "object",
                            properties: {
                                text: { type: "string", description: "La formulation de la proposition (Markdown autorisé)." }
                            },
                            required: ["text"]
                        }
                    }
                },
                {
                    type: "function",
                    function: {
                        name: "manage_speech_queue",
                        description: "Gérer la file d'attente des prises de parole.",
                        parameters: {
                            type: "object",
                            properties: {
                                action: { type: "string", enum: ["invite", "remove", "clear"] },
                                userId: { type: "string", description: "L'ID de l'utilisateur concerné." }
                            },
                            required: ["action"]
                        }
                    }
                },
                {
                    type: "function",
                    function: {
                        name: "generate_report",
                        description: "Générer un Procès-Verbal (PV) formel de la séance actuelle.",
                        parameters: {
                            type: "object",
                            properties: {},
                            required: []
                        }
                    }
                },
                {
                    type: "function",
                    function: {
                        name: "promote_to_plenary",
                        description: "Remonter le Procès-Verbal ou une proposition à l'assemblée plénière (Parent).",
                        parameters: {
                            type: "object",
                            properties: {
                                content: { type: "string", description: "Le contenu à transmettre (PV ou proposition)." }
                            },
                            required: ["content"]
                        },
                {
                    type: "function",
                    function: {
                        name: "consult_archives",
                        description: "Consulter les archives brutes (historique exact) pour des questions factuelles (Qui, Quand, Quoi).",
                        parameters: {
                            type: "object",
                            properties: {
                                query: { type: "string", description: "Mots-clés recherchés." },
                                user: { type: "string", description: "Filtrer par nom d'utilisateur (Speaker)." },
                                date_from: { type: "string", description: "Date de début (ISO)." },
                                type: { type: "string", description: "Type de message (ex: 'presence_log' pour arrivées/départs, 'vote', 'chat')." }
                            },
                            required: []
                        }
                    }
                }
            ];

            const response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${OpenAIKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: "gpt-4o",
                    messages,
                    tools,
                    tool_choice: "auto",
                }),
            });

            const data = await response.json();
            const message = data.choices[0].message;

            // Extract Voice: SaaS setting first, then System Prompt (e.g. "VOICE: shimmer"), then default
            let selectedVoice = room_settings?.ophelia?.voice || "nova";

            if (!room_settings?.ophelia?.voice) {
                const voiceMatch = system_prompt?.match(/VOICE:\s*(\w+)/i);
                if (voiceMatch) {
                    selectedVoice = voiceMatch[1].toLowerCase();
                }
            }

            // Handle Tool Calls
            if (message.tool_calls) {
                const results = [];
                for (const toolCall of message.tool_calls) {
                    const { name, arguments: argsJson } = toolCall.function;
                    const args = JSON.parse(argsJson);

                    let vocal_payload = null;
                    if (name === "speak" || (name === "send_message" && args.vocal_only)) {
                        // TTS Integration
                        const ttsResponse = await fetch("https://api.openai.com/v1/audio/speech", {
                            method: "POST",
                            headers: {
                                "Authorization": `Bearer ${OpenAIKey}`,
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                                model: "tts-1",
                                voice: selectedVoice,
                                input: args.text,
                            }),
                        });
                        const audioBlob = await ttsResponse.blob();
                        const buffer = await audioBlob.arrayBuffer();
                        vocal_payload = btoa(String.fromCharCode(...new Uint8Array(buffer)));
                    }

                    results.push({
                        tool: name,
                        args,
                        vocal_payload
                    });
                }

                return new Response(JSON.stringify({ actions: results }), {
                    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
                });
            }

            // Normal Text Response
            return new Response(JSON.stringify({ text: message.content }), {
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            });
        }

        return new Response("Action unknown", { status: 400 });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
    }
};

export const config = { path: "/api/ophelia" };
