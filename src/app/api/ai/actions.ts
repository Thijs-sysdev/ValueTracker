'use server';

import { searchArticleHistory } from '@/app/prijslijsten-beheer/actions';

/**
 * Parses a natural language question, extracts potential article numbers,
 * searches the database for them, and returns a formatted context string
 * for the LLM.
 */
export async function getAiContextForQuestion(question: string): Promise<string> {
    if (!question || typeof question !== 'string') return '';

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

    if (codesToSearch.length === 0) return '';

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
    if (results.length === 0) {
        return '';
    }

    let contextString = 'GEVONDEN ARTIKELEN IN DATABASE:\n\n';

    for (const item of results) {
        contextString += `Artikel: ${item.article_number}\n`;
        contextString += `Fabrikant: ${item.manufacturer || 'Onbekend'}\n`;
        if (item.history && Array.isArray(item.history)) {
            contextString += `Prijshistorie (Jaar -> Bruto Prijs):\n`;
            item.history.forEach((h: any) => {
                contextString += ` - ${h.year}: €${h.price}\n`;
            });
        }
        contextString += '\n';
    }

    return contextString;
}
