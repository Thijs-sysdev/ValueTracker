/**
 * rag/ingestion.ts
 *
 * Reads source documents from the shared OneDrive "documents" folder,
 * splits them into overlapping text chunks, generates embeddings,
 * and writes the results into the local machine Orama vector store.
 *
 * Supported file types: .txt, .md
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getDocumentsDir } from './paths';
import { generateEmbedding } from './embeddings';
import { insertChunks, persistStore, removeChunksBySourceFile, type ChunkDocument } from './vectorStore';

const SUPPORTED_EXTENSIONS = ['.txt', '.md'];
const CHUNK_SIZE = 500;     // Target characters per chunk
const CHUNK_OVERLAP = 100;  // Characters of overlap between consecutive chunks

/**
 * Splits a long text into overlapping character-level chunks.
 */
function splitIntoChunks(text: string): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
        const end = Math.min(start + CHUNK_SIZE, text.length);
        chunks.push(text.slice(start, end).trim());
        start += CHUNK_SIZE - CHUNK_OVERLAP;
        if (start >= text.length) break;
    }

    return chunks.filter((c) => c.length > 20); // Drop very short chunks
}

/**
 * Generates a stable, deterministic ID for a chunk based on its source and position.
 */
function generateChunkId(sourceFile: string, chunkIndex: number): string {
    return crypto.createHash('md5').update(`${sourceFile}:${chunkIndex}`).digest('hex');
}

/** Result object returned after ingesting a single file. */
export interface IngestionResult {
    file: string;
    chunksInserted: number;
    error?: string;
}

/**
 * Ingests a single file from the shared documents directory.
 * If the file was previously indexed, old chunks are removed first (re-index).
 */
export async function ingestFile(filePath: string): Promise<IngestionResult> {
    const fileName = path.basename(filePath);
    try {
        const rawText = fs.readFileSync(filePath, 'utf-8');
        const textChunks = splitIntoChunks(rawText);

        // Remove stale chunks for this file before re-indexing
        await removeChunksBySourceFile(fileName);

        const documents: ChunkDocument[] = [];
        for (let i = 0; i < textChunks.length; i++) {
            const embedding = await generateEmbedding(textChunks[i]);
            documents.push({
                id: generateChunkId(fileName, i),
                content: textChunks[i],
                sourceFile: fileName,
                chunkIndex: i,
                embedding,
            });
        }

        await insertChunks(documents);
        console.log(`[RAG/Ingestion] Ingested "${fileName}": ${documents.length} chunks.`);
        return { file: fileName, chunksInserted: documents.length };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[RAG/Ingestion] Failed to ingest "${fileName}":`, message);
        return { file: fileName, chunksInserted: 0, error: message };
    }
}

/**
 * Scans the shared OneDrive documents folder and ingests all supported files.
 * Saves the index to disk after all files have been processed.
 * This is the main function to call from the UI or a setup wizard.
 */
export async function ingestAllDocuments(): Promise<IngestionResult[]> {
    const docsDir = getDocumentsDir();

    if (!fs.existsSync(docsDir)) {
        fs.mkdirSync(docsDir, { recursive: true });
        console.log('[RAG/Ingestion] Documents directory created:', docsDir);
        return [];
    }

    const files = fs.readdirSync(docsDir)
        .filter((f) => SUPPORTED_EXTENSIONS.includes(path.extname(f).toLowerCase()))
        .map((f) => path.join(docsDir, f));

    if (files.length === 0) {
        console.log('[RAG/Ingestion] No supported documents found in:', docsDir);
        return [];
    }

    console.log(`[RAG/Ingestion] Found ${files.length} documents. Starting ingestion...`);
    const results: IngestionResult[] = [];

    for (const filePath of files) {
        const result = await ingestFile(filePath);
        results.push(result);
    }

    // Persist the updated index to disk once all files are done
    await persistStore();
    console.log('[RAG/Ingestion] All documents ingested and index saved.');
    return results;
}
