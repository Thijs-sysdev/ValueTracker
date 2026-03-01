'use server';

import { searchArticleHistory } from '@/app/prijslijsten-beheer/actions';
import { getDataFilePath } from '@/lib/dataPath';
import * as fs from 'fs';
import { retrieveContext, formatContextForPrompt } from '@/lib/rag/retrieval';

/**
 * Builds a rich context string for the LLM by running two searches in parallel:
 *  1. RAG vector search — semantically matches text chunks from the documents folder.
 *  2. Price-DB keyword search — looks up concrete pricing history by article number.
 *
 * Both results are merged into a single prompt context block. If either source
 * returns nothing it simply contributes an empty section, so they degrade gracefully.
 */
export async function getAiContextForQuestion(question: string): Promise<{ contextString: string, matchedCodes: string[] }> {
    if (!question || typeof question !== 'string') return { contextString: '', matchedCodes: [] };

    const stopWords = ['de', 'het', 'een', 'van', 'voor', 'wat', 'hoe', 'prijs', 'prijzen', 'serie', 'is', 'zijn', 'kosten', 'kost'];
    const words = question.replace(/[?,.!]/g, ' ').split(/\s+/).filter(w => w.length > 1 && !stopWords.includes(w.toLowerCase()));

    // ── Run both context sources in parallel ──────────────────────────────────
    const [ragResult, priceDbResult] = await Promise.allSettled([

        // 1. RAG: semantic vector search over knowledge-base documents
        (async () => {
            const hits = await retrieveContext(question, 5);
            return formatContextForPrompt(hits);
        })(),

        // 2. Price-DB: structural keyword + article-number lookup (unchanged logic)
        (async () => {
            const potentialCodes = words.filter(w => w.length >= 4 && /[a-zA-Z]/.test(w) && /[0-9]/.test(w));
            const extraCodes = words.filter(w => w.length >= 4 && (/^[A-Z0-9-]+$/.test(w)) && !potentialCodes.includes(w));
            const codesToSearch = [...potentialCodes, ...extraCodes];

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let results: any[] = [];
            const seen = new Set<string>();

            // Exact article number matches first
            for (const code of codesToSearch) {
                if (seen.has(code.toLowerCase())) continue;
                seen.add(code.toLowerCase());
                const match = await searchArticleHistory(code);
                if (match) results.push(match);
            }

            // Broad keyword sweep fallback
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

    // ── Assemble context sections ─────────────────────────────────────────────
    const sections: string[] = [];
    let matchedCodes: string[] = [];

    // Section 1 — Knowledge-base documents (RAG)
    if (ragResult.status === 'fulfilled' && ragResult.value && !ragResult.value.startsWith('No relevant context')) {
        sections.push(`=== KENNISBANK (semantische zoekresultaten) ===\n${ragResult.value}`);
    } else if (ragResult.status === 'rejected') {
        // RAG not yet initialised (no documents ingested) — silently skip
        console.warn('[AI/Context] RAG retrieval skipped:', ragResult.reason);
    }

    // Section 2 — Structured price database (keyword)
    if (priceDbResult.status === 'fulfilled' && priceDbResult.value.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const items: any[] = priceDbResult.value;
        matchedCodes = items.map(r => r.article_number);
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
    };
}
