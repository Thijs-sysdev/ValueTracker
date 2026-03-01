/**
 * rag/retrieval.ts
 *
 * Public interface for querying the RAG system.
 *
 * Takes a natural-language question, embeds it, performs a vector similarity
 * search on the local Orama index, and returns the most relevant text chunks.
 * These chunks can then be injected as context into a node-llama-cpp prompt.
 */

import { generateEmbedding } from './embeddings';
import { searchSimilar } from './vectorStore';

export interface RetrievalResult {
    content: string;
    sourceFile: string;
    score: number;
}

/**
 * Retrieves the top K most semantically similar chunks for a given query.
 *
 * @param query   - The user's natural language question.
 * @param topK    - Maximum number of chunks to return (default: 5).
 * @returns       An array of the most relevant text chunks + their source files.
 */
export async function retrieveContext(query: string, topK = 5): Promise<RetrievalResult[]> {
    console.log(`[RAG/Retrieval] Querying for: "${query}"`);
    const queryVector = await generateEmbedding(query);
    const hits = await searchSimilar(queryVector, topK);

    return hits.map((hit, i) => ({
        content: hit.content,
        sourceFile: hit.sourceFile,
        score: i, // Orama returns hits sorted by similarity; lower index = better match
    }));
}

/**
 * Formats retrieved chunks into a context block ready to be injected
 * into a system prompt for node-llama-cpp.
 *
 * Example output:
 * ```
 * [Context from: pricelist_2024.txt]
 * Siemens PLC 6ES7 series gross price: €1200 ...
 *
 * [Context from: pricelist_2024.txt]
 * Allen Bradley ControlLogix ...
 * ```
 */
export function formatContextForPrompt(results: RetrievalResult[]): string {
    if (results.length === 0) {
        return 'No relevant context found in the knowledge base.';
    }

    return results
        .map((r) => `[Context from: ${r.sourceFile}]\n${r.content}`)
        .join('\n\n');
}
