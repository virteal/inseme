import { OpenAI } from "https://deno.land/x/openai@v4.24.1/mod.ts";

export default async (request, context) => {
    // CORS
    if (request.method === "OPTIONS") {
        return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" } });
    }

    try {
        const { text, target_lang } = await request.json();

        if (!text || !target_lang) {
            return new Response("Missing text or target_lang", { status: 400 });
        }

        const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY") });

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `You are a professional translator. Translate the user's text into ${target_lang}. Return ONLY the translated text, no introductory or concluding remarks. Preserve the tone and formatting.`
                },
                { role: "user", content: text }
            ],
            temperature: 0.3,
        });

        const translated_text = completion.choices[0].message.content;

        return new Response(JSON.stringify({ translated_text }), {
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
};

export const config = { path: "/api/translate" };
