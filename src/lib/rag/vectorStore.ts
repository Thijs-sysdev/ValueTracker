/**
 * rag/vectorStore.ts
 *
 * Manages the Orama vector database instance.
 * The index is persisted to a local JSON file in %APPDATA% (NOT in OneDrive).
 *
 * On first run (no file found), an empty database is created.
 * After ingestion, `persistStore()` is called to save it to disk.
 */

import { create, search, insert, removeMultiple, type Results } from '@orama/orama';
import { persist, restore } from '@orama/plugin-data-persistence';
import fs from 'fs';
import path from 'path';
import { getVectorDbPath } from './paths';
import { EMBEDDING_DIMENSIONS } from './embeddings';

/** Schema of each document chunk stored in the vector DB. */
const SCHEMA = {
    id: 'string',
    content: 'string',
    sourceFile: 'string',
    chunkIndex: 'number',
    embedding: `vector[${EMBEDDING_DIMENSIONS}]`,
} as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any = null;

/**
 * Returns the initialized Orama DB instance.
 * Loads from disk if available, otherwise creates a fresh empty DB.
 */
export async function getVectorStore() {
    if (db) return db;

    const dbPath = getVectorDbPath();

    if (fs.existsSync(dbPath)) {
        try {
            console.log('[RAG/VectorStore] Loading existing index from:', dbPath);
            const serialized = fs.readFileSync(dbPath, 'utf-8');
            db = await restore('json', serialized);
            console.log('[RAG/VectorStore] Index loaded successfully.');
            return db;
        } catch (e) {
            console.warn('[RAG/VectorStore] Failed to load existing index, creating fresh one.', e);
        }
    }

    console.log('[RAG/VectorStore] Creating new empty index.');
    db = await create({
        schema: SCHEMA,
        components: {
            tokenizer: { language: 'english', stemming: true },
        },
    });

    return db;
}

/**
 * Persists the current in-memory database to disk (in local AppData, not OneDrive).
 */
export async function persistStore(): Promise<void> {
    if (!db) return;
    const dbPath = getVectorDbPath();
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const serialized = await persist(db, 'json');
    fs.writeFileSync(dbPath, serialized as string, 'utf-8');
    console.log('[RAG/VectorStore] Index persisted to:', dbPath);
}

/** Represents a single text chunk stored in the index. */
export interface ChunkDocument {
    id: string;
    content: string;
    sourceFile: string;
    chunkIndex: number;
    embedding: number[];
}

/**
 * Inserts an array of document chunks into the vector DB.
 */
export async function insertChunks(chunks: ChunkDocument[]): Promise<void> {
    const store = await getVectorStore();
    for (const chunk of chunks) {
        await insert(store, chunk);
    }
}

/**
 * Removes all chunks that originated from a specific source file.
 * Used when re-indexing a file after it has been updated.
 */
export async function removeChunksBySourceFile(sourceFile: string): Promise<void> {
    const store = await getVectorStore();
    const results: Results<typeof SCHEMA> = await search(store, {
        term: '',
        where: { sourceFile: { eq: sourceFile } },
        limit: 10000,
    });
    const ids = results.hits.map((h) => h.id);
    if (ids.length > 0) {
        await removeMultiple(store, ids);
        console.log(`[RAG/VectorStore] Removed ${ids.length} chunks for file: ${sourceFile}`);
    }
}

/**
 * Performs a vector similarity search and returns the top N matching chunks.
 */
export async function searchSimilar(queryVector: number[], limit = 5): Promise<ChunkDocument[]> {
    const store = await getVectorStore();
    const results: Results<typeof SCHEMA> = await search(store, {
        mode: 'vector',
        vector: { value: queryVector, property: 'embedding' },
        similarity: 0.7,
        limit,
    });
    return results.hits.map((h) => h.document as unknown as ChunkDocument);
}

/**
 * Resets the in-memory db singleton. Useful in tests or after wiping the index.
 */
export function resetVectorStore(): void {
    db = null;
}
