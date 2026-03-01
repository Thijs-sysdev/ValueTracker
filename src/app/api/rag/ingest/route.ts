import { NextRequest, NextResponse } from 'next/server';
import { ingestAllDocuments, IngestionResult } from '@/lib/rag/ingestion';
import { getDocumentsDir } from '@/lib/rag/paths';

export async function POST(_req: NextRequest) {
    try {
        const docsDir = getDocumentsDir();
        const results: IngestionResult[] = await ingestAllDocuments();
        const totalChunks = results.reduce((sum, r) => sum + r.chunksInserted, 0);
        const errors = results.filter((r) => r.error).map((r) => ({ file: r.file, error: r.error }));

        return NextResponse.json({
            success: true,
            documentsDir: docsDir,
            filesProcessed: results.length,
            totalChunksInserted: totalChunks,
            errors,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[API/RAG/Ingest]', message);
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function GET(_req: NextRequest) {
    // Returns info about where documents should be placed (useful for the UI)
    return NextResponse.json({ documentsDir: getDocumentsDir() });
}
