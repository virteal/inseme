import OpenAI from "https://esm.sh/openai@4";
import { defineEdgeFunction } from "../../../../../packages/cop-host/src/runtime/edge.js";

export const config = {
  path: "/api/transcribe",
};

export default defineEdgeFunction(async (request, runtime, context) => {
  const { getConfig, json, error } = runtime;
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return error("No file provided", 400);
    }

    const apiKey = getConfig("OPENAI_API_KEY");
    if (!apiKey) {
      return error("OpenAI API key missing", 500);
    }

    const openai = new OpenAI({ apiKey });

    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: "whisper-1",
    });

    return json({ text: transcription.text });
  } catch (err) {
    console.error("Transcription Error:", err);
    return error(err.message);
  }
});
