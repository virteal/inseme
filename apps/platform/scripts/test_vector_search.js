import { loadConfig, createSupabaseClient, createOpenAIClient } from "./lib/config.js";

// Charger la configuration
await loadConfig();

const supabase = createSupabaseClient();
const openai = await createOpenAIClient();

async function testVectorSearch(query) {
  console.log(`🔍 Testing vector search for: "${query}"`);

  try {
    // Embed the query
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;
    console.log(`✅ Query embedded (${queryEmbedding.length} dimensions)`);

    // Search in knowledge_chunks - select all and compute similarity in JS
    const { data, error } = await supabase
      .from("knowledge_chunks")
      .select("text, metadata, embedding");

    if (error) {
      console.error("❌ Supabase error:", error);
      return;
    }

    if (!data || data.length === 0) {
      console.log("❌ No chunks found");
      return;
    }

    // Compute cosine similarity (dot product since embeddings are normalized)
    const chunksWithSimilarity = data.map((chunk) => {
      let embeddingArray;
      try {
        embeddingArray = JSON.parse(chunk.embedding);
      } catch (e) {
        console.log("Failed to parse embedding:", e.message);
        return { ...chunk, similarity: 0 };
      }
      if (!Array.isArray(embeddingArray) || embeddingArray.length !== 1536) {
        console.log("Invalid embedding array length:", embeddingArray.length);
        return { ...chunk, similarity: 0 };
      }
      const similarity = queryEmbedding.reduce((sum, q, i) => sum + q * embeddingArray[i], 0);
      return { ...chunk, similarity };
    });

    // Sort by similarity descending and take top 3
    chunksWithSimilarity.sort((a, b) => b.similarity - a.similarity);
    const topChunks = chunksWithSimilarity.slice(0, 3);

    console.log(`📚 Found ${topChunks.length} most relevant chunks:`);
    topChunks.forEach((chunk, i) => {
      console.log(`\n${i + 1}. **${chunk.metadata?.title || "Untitled"}**`);
      console.log(`   Similarity: ${chunk.similarity.toFixed(4)}`);
      console.log(`   Content: ${chunk.text.substring(0, 200)}...`);
    });
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

// Test with command line argument or default question
const query = process.argv[2] || "Quelle est l'histoire de la place forte de Corte ?";
testVectorSearch(query);
