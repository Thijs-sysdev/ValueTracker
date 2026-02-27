'use server';

import { searchArticleHistory } from '@/app/prijslijsten-beheer/actions';
import { getDataFilePath } from '@/lib/dataPath';
import * as fs from 'fs';

/**
 * Parses a natural language question, extracts potential article numbers,
 * searches the database for them, and returns a formatted context string
 * for the LLM.
 */
export async function getAiContextForQuestion(question: string): Promise<{ contextString: string, matchedCodes: string[] }> {
    if (!question || typeof question !== 'string') return { contextString: '', matchedCodes: [] };

    const stopWords = ['de', 'het', 'een', 'van', 'voor', 'wat', 'hoe', 'prijs', 'prijzen', 'serie', 'is', 'zijn', 'kosten', 'kost'];
    const words = question.replace(/[?,.!]/g, ' ').split(/\s+/).filter(w => w.length > 1 && !stopWords.includes(w.toLowerCase()));

    // 1. Extract potential EXACT article numbers (e.g. 6ES7...)
    const potentialCodes = words.filter(w => w.length >= 4 && /[a-zA-Z]/.test(w) && /[0-9]/.test(w));
    const extraCodes = words.filter(w => w.length >= 4 && (/^[A-Z0-9-]+$/.test(w)) && !potentialCodes.includes(w));
    const codesToSearch = [...potentialCodes, ...extraCodes];

    let results: any[] = [];
    const seen = new Set<string>();

    // 2. Try strict codes first using the existing search
    for (const code of codesToSearch) {
        if (seen.has(code.toLowerCase())) continue;
        seen.add(code.toLowerCase());

        const match = await searchArticleHistory(code);
        if (match) results.push(match);
    }

    // 3. BROAD SWEEP (Agentic Search fallback)
    // If no exact matches are found, we broaden the search across the entire DB 
    // to find trends or categories (e.g. "S7")
    if (results.length === 0 && words.length > 0) {
        try {
            const dbPath = getDataFilePath('price_db.json');
            if (fs.existsSync(dbPath)) {
                const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));

                // Score items based on how many keywords match their article_number or manufacturer
                const scoredItems: { item: any, score: number }[] = [];

                for (const key of Object.keys(db)) {
                    const item = db[key];
                    let score = 0;
                    const searchableString = `${item.article_number} ${item.manufacturer}`.toLowerCase();

                    for (const word of words) {
                        if (searchableString.includes(word.toLowerCase())) {
                            score += word.length; // Longer words yield higher score weight
                        }
                    }

                    if (score > 0) {
                        scoredItems.push({ item, score });
                    }
                }

                if (scoredItems.length > 0) {
                    scoredItems.sort((a, b) => b.score - a.score);
                    // Extract Top 15 items for broad trend analysis
                    results = scoredItems.slice(0, 15).map(si => si.item);
                }
            }
        } catch (e) {
            console.error("Broad search failed:", e);
        }
    }

    // 4. Format the results into a dense string for the LLM
    // Increased limit to 15 now that GPU offloading is active, for better trend analysis
    const limitedResults = results.slice(0, 15);
    const matchedCodes = limitedResults.map(r => r.article_number);

    if (limitedResults.length === 0) {
        return { contextString: '', matchedCodes: [] };
    }

    // Dense pseudo-CSV format is vastly faster for LLMs to read than verbose sentences
    let contextString = 'DATABASE CONTEXT (MAX 15 MATCHES):\n';

    for (const item of limitedResults) {
        let prices = '';
        if (item.history && Array.isArray(item.history)) {
            // Use full 4-digit years to prevent the LLM misinterpreting '22' as 'May 22' or days
            prices = item.history.map((h: any) => `${h.year}: €${h.price}`).join(' | ');
        }

        contextString += `[Artikel: ${item.article_number} | Prijzen: ${prices}]\n`;
    }

    return { contextString, matchedCodes };
}
