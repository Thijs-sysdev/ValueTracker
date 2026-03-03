import { NextRequest, NextResponse } from 'next/server';
import { retrieveContext, formatContextForPrompt } from '@/lib/rag/retrieval';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { query, topK = 5 } = body as { query: string; topK?: number };

        if (!query || typeof query !== 'string') {
            return NextResponse.json({ success: false, error: 'query is required' }, { status: 400 });
        }

        const results = await retrieveContext(query, topK);
        const formattedContext = formatContextForPrompt(results);

        return NextResponse.json({
            success: true,
            query,
            results,
            formattedContext,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[API/RAG/Query]', message);
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
