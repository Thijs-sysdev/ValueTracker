'use server';

import { searchArticleHistory } from '@/app/prijslijsten-beheer/actions';

/**
 * Parses a natural language question, extracts potential article numbers,
 * searches the database for them, and returns a formatted context string
 * for the LLM.
 */
export async function getAiContextForQuestion(question: string): Promise<{ contextString: string, matchedCodes: string[] }> {
    if (!question || typeof question !== 'string') return { contextString: '', matchedCodes: [] };

    // 1. Extract potential article numbers from the query.
    // Example: "Wat kost de 6ES7215-1AG40-0XB0 in 2023?"
    // We look for alphanumeric strings of at least 5 characters.
    const words = question.replace(/[?,.!]/g, ' ').split(/\s+/);
    const potentialCodes = words.filter(w => w.length >= 5 && /[a-zA-Z]/.test(w) && /[0-9]/.test(w));

    // Also include any word that is purely uppercase or purely numbers if it's long enough
    const extraCodes = words.filter(w => w.length >= 5 && (/^[A-Z0-9-]+$/.test(w)) && !potentialCodes.includes(w));

    const codesToSearch = [...potentialCodes, ...extraCodes];

    // If no strong candidates found, let's just use the longest words as a fallback
    if (codesToSearch.length === 0) {
        const longWords = words.filter(w => w.length >= 5);
        codesToSearch.push(...longWords.slice(0, 3));
    }

    if (codesToSearch.length === 0) return { contextString: '', matchedCodes: [] };

    const results: any[] = [];
    const seen = new Set<string>();

    // 2. Search the database for each potential code.
    for (const code of codesToSearch) {
        if (seen.has(code.toLowerCase())) continue;
        seen.add(code.toLowerCase());

        const match = await searchArticleHistory(code);
        if (match) {
            results.push(match);
        }
    }

    // 3. Format the results into a dense string for the LLM
    // Limit to max 5 results to prevent massive prompt evaluations on CPU
    const limitedResults = results.slice(0, 5);
    const matchedCodes = limitedResults.map(r => r.article_number);

    if (limitedResults.length === 0) {
        return { contextString: '', matchedCodes: [] };
    }

    // Dense pseudo-CSV format is vastly faster for LLMs to read than verbose sentences
    let contextString = 'DATABASE CONTEXT (MAX 5 MATCHES):\n';

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
