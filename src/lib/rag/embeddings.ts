/**
 * rag/embeddings.ts
 *
 * Manages text-to-vector embedding using @huggingface/transformers running locally.
 * The model is downloaded once and cached to the machine-local models dir (NOT OneDrive).
 *
 * Model: Xenova/all-MiniLM-L6-v2
 *  - 22M params, very lightweight and fast
 *  - Produces 384-dimensional vectors
 *  - Well-suited for semantic similarity tasks
 */

import { pipeline, env } from '@huggingface/transformers';
import fs from 'fs';
import { getRagModelsDir } from './paths';

const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let extractor: any = null;

/**
 * Initializes the embedding pipeline, ensuring the model is cached locally
 * and not in the default system cache or anywhere near OneDrive.
 */
async function getExtractor() {
    if (extractor) return extractor;

    const modelsDir = getRagModelsDir();
    if (!fs.existsSync(modelsDir)) {
        fs.mkdirSync(modelsDir, { recursive: true });
    }

    // Redirect HuggingFace cache to our local AppData models directory.
    env.cacheDir = modelsDir;
    // Do not use remote model hosting in Electron production builds.
    env.allowLocalModels = true;
    env.allowRemoteModels = true;

    console.log(`[RAG/Embeddings] Loading model from: ${modelsDir}`);
    extractor = await pipeline('feature-extraction', MODEL_ID, {
        dtype: 'fp32',
    });
    console.log('[RAG/Embeddings] Embedding model ready.');
    return extractor;
}

/**
 * Converts a text string into an embedding vector (array of floats).
 * Mean-pools the token-level embeddings into a single sentence vector.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
    const extract = await getExtractor();
    const output = await extract(text, { pooling: 'mean', normalize: true });
    // Convert the raw Float32Array tensor to a plain JS number array.
    return Array.from(output.data as Float32Array);
}

/** The dimensionality of the embedding vectors produced by this model. */
export const EMBEDDING_DIMENSIONS = 384;
