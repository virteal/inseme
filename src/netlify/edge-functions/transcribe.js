// src/netlify/edge-functions/transcribe.js

import { OpenAI } from "https://deno.land/x/openai@v4.24.1/mod.ts";

export default async (request, context) => {
    // CORS
    if (request.method === "OPTIONS") {
        return new Response("ok", {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
            },
        });
    }

    try {
        const formData = await request.formData();
        const file = formData.get("file");

        if (!file) {
            return new Response(JSON.stringify({ error: "No file provided" }), { status: 400 });
        }

        const apiKey = Deno.env.get("OPENAI_API_KEY");
        if (!apiKey) {
            return new Response(JSON.stringify({ error: "OpenAI API key missing" }), { status: 500 });
        }

        const openai = new OpenAI({ apiKey });

        const transcription = await openai.audio.transcriptions.create({
            file: file,
            model: "whisper-1",
        });

        return new Response(JSON.stringify({ text: transcription.text }), {
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
        });

    } catch (error) {
        console.error("Transcription Error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Access-Control-Allow-Origin": "*" }
        });
    }
};

export const config = {
    path: "/api/transcribe",
};
