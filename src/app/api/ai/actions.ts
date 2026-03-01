'use server';

import { searchArticleHistory } from '@/app/prijslijsten-beheer/actions';
import { getDataFilePath } from '@/lib/dataPath';
import * as fs from 'fs';
import { retrieveContext, formatContextForPrompt } from '@/lib/rag/retrieval';
import { detectAnalysisIntent, aggregateByManufacturer, AggregationResult } from '@/lib/ai/aggregator';

/**
 * Builds a rich context string for the LLM by running up to three searches in parallel:
 *  1. Detective AI (aggregator) — if a trend question is detected, computes live stats.
 *  2. RAG vector search — semantically matches text chunks from the documents folder.
 *  3. Price-DB keyword search — looks up concrete pricing history by article number.
 *
 * Returns both the merged context string AND optional chart data for the UI to render.
 */
export async function getAiContextForQuestion(question: string): Promise<{
    contextString: string;
    matchedCodes: string[];
    chartData?: AggregationResult;
}> {
    if (!question || typeof question !== 'string') return { contextString: '', matchedCodes: [] };

    const stopWords = ['de', 'het', 'een', 'van', 'voor', 'wat', 'hoe', 'prijs', 'prijzen', 'serie', 'is', 'zijn', 'kosten', 'kost'];
    const words = question.replace(/[?,.!]/g, ' ').split(/\s+/).filter(w => w.length > 1 && !stopWords.includes(w.toLowerCase()));

    // ── Detect if this is a "trend / analysis" question ──────────────────────
    const analysisIntent = detectAnalysisIntent(question);

    // ── Run all context sources in parallel ───────────────────────────────────
    const [detectorResult, ragResult, priceDbResult] = await Promise.allSettled([

        // 1. Detective AI — only runs if trend intent detected, otherwise resolves null
        (async () => {
            if (!analysisIntent) return null;
            console.log(`[AI/Context] Detective mode activated for: ${analysisIntent.manufacturer}`);
            return aggregateByManufacturer(analysisIntent.manufacturer);
        })(),

        // 2. RAG: semantic vector search over knowledge-base documents
        (async () => {
            const hits = await retrieveContext(question, 5);
            return formatContextForPrompt(hits);
        })(),

        // 3. Price-DB: structural keyword + article-number lookup
        (async () => {
            const potentialCodes = words.filter(w => w.length >= 4 && /[a-zA-Z]/.test(w) && /[0-9]/.test(w));
            const extraCodes = words.filter(w => w.length >= 4 && (/^[A-Z0-9-]+$/.test(w)) && !potentialCodes.includes(w));
            const codesToSearch = [...potentialCodes, ...extraCodes];

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let results: any[] = [];
            const seen = new Set<string>();

            for (const code of codesToSearch) {
                if (seen.has(code.toLowerCase())) continue;
                seen.add(code.toLowerCase());
                const match = await searchArticleHistory(code);
                if (match) results.push(match);
            }

            if (results.length === 0 && words.length > 0) {
                const dbPath = getDataFilePath('price_db.json');
                if (fs.existsSync(dbPath)) {
                    const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const scored: { item: any; score: number }[] = [];
                    for (const key of Object.keys(db)) {
                        const item = db[key];
                        let score = 0;
                        const str = `${item.article_number} ${item.manufacturer}`.toLowerCase();
                        for (const word of words) {
                            if (str.includes(word.toLowerCase())) score += word.length;
                        }
                        if (score > 0) scored.push({ item, score });
                    }
                    if (scored.length > 0) {
                        scored.sort((a, b) => b.score - a.score);
                        results = scored.slice(0, 15).map(s => s.item);
                    }
                }
            }

            return results.slice(0, 15);
        })(),
    ]);

    // ── Assemble context sections ──────────────────────────────────────────────
    const sections: string[] = [];
    let matchedCodes: string[] = [];
    let chartData: AggregationResult | undefined;

    // Section 1 — Detective AI (trend analysis)
    if (detectorResult.status === 'fulfilled' && detectorResult.value) {
        chartData = detectorResult.value;
        sections.push(detectorResult.value.contextString);
    } else if (detectorResult.status === 'rejected') {
        console.warn('[AI/Context] Aggregator failed:', detectorResult.reason);
    }

    // Section 2 — Knowledge-base documents (RAG)
    if (ragResult.status === 'fulfilled' && ragResult.value && !ragResult.value.startsWith('No relevant context')) {
        sections.push(`=== KENNISBANK (semantische zoekresultaten) ===\n${ragResult.value}`);
    } else if (ragResult.status === 'rejected') {
        console.warn('[AI/Context] RAG retrieval skipped:', ragResult.reason);
    }

    // Section 3 — Structured price database (keyword)
    if (priceDbResult.status === 'fulfilled' && priceDbResult.value.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const items: any[] = priceDbResult.value;
        // Only use keyword-matched codes for the "Bekijk in Database" button if no chart present
        if (!chartData) {
            matchedCodes = items.map(r => r.article_number);
        }
        let priceBlock = '=== PRIJSDATABASE (MAX 15 ARTIKELEN) ===\n';
        for (const item of items) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const prices = item.history?.map((h: any) => `${h.year}: €${h.price}`).join(' | ') ?? '';
            priceBlock += `[Artikel: ${item.article_number} | Prijzen: ${prices}]\n`;
        }
        sections.push(priceBlock);
    } else if (priceDbResult.status === 'rejected') {
        console.warn('[AI/Context] Price-DB lookup failed:', priceDbResult.reason);
    }

    if (sections.length === 0) return { contextString: '', matchedCodes: [] };

    return {
        contextString: sections.join('\n\n'),
        matchedCodes,
        chartData,
    };
}
