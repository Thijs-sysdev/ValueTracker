/**
 * rag/paths.ts
 *
 * Centralised path resolution for the RAG system.
 *
 * KEY DESIGN DECISION — Two storage locations:
 *
 * 1. SHARED (OneDrive / synced folder via getDataDir()):
 *    - documents/   ->  Source files users drop in to be ingested.
 *                       Changes here are picked up by all colleagues.
 *
 * 2. LOCAL (%APPDATA%/ValueTracker/rag/):
 *    - models/      ->  Heavy embedding model files downloaded from HuggingFace.
 *    - vectorStore.json  The Orama vector index built from the shared documents.
 *
 * Heavy AI data lives locally to avoid polluting/bloating the OneDrive sync.
 * Each machine builds and maintains its own local index from the shared source files.
 */

import path from 'path';
import os from 'os';
import { getDataDir } from '../dataPath';

/**
 * The base directory for machine-local RAG data (NOT synced to OneDrive).
 * Lives in %APPDATA%/ValueTracker/rag/
 */
export function getLocalRagDir(): string {
    return path.join(os.homedir(), 'AppData', 'Roaming', 'ValueTracker', 'rag');
}

/**
 * Where HuggingFace embedding models are downloaded and cached.
 * Machine-local only.
 */
export function getRagModelsDir(): string {
    return path.join(getLocalRagDir(), 'models');
}

/**
 * Path to the persisted Orama vector database index file.
 * Machine-local only.
 */
export function getVectorDbPath(): string {
    return path.join(getLocalRagDir(), 'vectorStore.json');
}

/**
 * The shared "drop zone" for source documents to be ingested.
 * Lives inside the user-configured OneDrive data folder (synced!).
 * Users place .txt, .md, or other text files here to make them
 * searchable by the AI.
 */
export function getDocumentsDir(): string {
    return path.join(getDataDir(), 'documents');
}
