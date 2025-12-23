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
            const messages = [
                {
                    role: "system",
                    content: `${system_prompt || "Tu es Ophélia, médiatrice d'Inseme."}\n\nContexte Actuel de la Salle (${room_id}) :\n${JSON.stringify(room_context, null, 2)}`
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
