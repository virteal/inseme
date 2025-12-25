import OpenAI from "https://esm.sh/openai@4";
import { defineEdgeFunction } from "../../../../packages/cop-host/src/runtime/edge.js";

export default defineEdgeFunction(async (request, runtime, context) => {
    const { getConfig, json, error } = runtime;
    try {
        const { text, target_lang } = await request.json();

        if (!text || !target_lang) {
            return error("Missing text or target_lang", 400);
        }

        const apiKey = getConfig('OPENAI_API_KEY');
        const openai = new OpenAI({ apiKey });

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

        return json({ translated_text });

    } catch (err) {
        return error(err.message);
    }
});

export const config = { path: "/api/translate" };

