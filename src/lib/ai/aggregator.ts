/**
 * lib/ai/aggregator.ts
 *
 * "Detective AI" — Real-time business intelligence over the price database.
 *
 * Scans price_db.json (1.1M entries) and computes aggregate statistics:
 *   - Average price per year for a given manufacturer (and optional category).
 *   - Total number of unique articles included.
 *   - Year range of available data.
 *
 * Designed to be called on-demand when the LLM detects a trend/analysis question.
 * The computed data is then injected back into the LLM context and returned as
 * a structured payload for chart rendering.
 */

import fs from 'fs';
import { getDataFilePath } from '@/lib/dataPath';

// ── Types ────────────────────────────────────────────────────────────────────

export interface YearlyAverage {
    year: number;
    avgPrice: number;
    articleCount: number;
}

export interface AggregationResult {
    manufacturer: string;
    category?: string;
    yearlyData: YearlyAverage[];
    totalArticles: number;
    /** Formatted as a concise LLM-ready text summary */
    contextString: string;
}

// ── Core Aggregator ──────────────────────────────────────────────────────────

/**
 * Detects if a user question is asking for a trend/analysis (not a specific part).
 * Returns the manufacturer name detected in the query, or null if no trend intent.
 */
export function detectAnalysisIntent(question: string): { manufacturer: string } | null {
    const trendKeywords = ['trend', 'ontwikkeling', 'verandering', 'gestegen', 'gedaald', 'prijshistorie', 'gemiddelde', 'historisch', 'over de jaren', 'afgelopen'];
    const lowerQ = question.toLowerCase();

    const hasTrendKeyword = trendKeywords.some(k => lowerQ.includes(k));
    if (!hasTrendKeyword) return null;

    // Known manufacturer names to detect
    const knownManufacturers = [
        'Siemens', 'Allen Bradley', 'Allen-Bradley', 'Lenze', 'Schneider',
        'Phoenix Contact', 'Wago', 'Pepperl', 'Turck', 'Pilz', 'Beckhoff',
        'Danfoss', 'ABB', 'Omron', 'Mitsubishi', 'Fanuc', 'Bosch', 'SEW',
        'Rockwell', 'Eldon', 'Rittal'
    ];

    for (const mfr of knownManufacturers) {
        if (lowerQ.includes(mfr.toLowerCase())) {
            return { manufacturer: mfr };
        }
    }

    return null;
}

/**
 * Reads the price_db.json and computes yearly average prices for a given manufacturer.
 * This is optimized to scan the large file in one pass without holding all data in memory.
 */
export async function aggregateByManufacturer(manufacturer: string): Promise<AggregationResult | null> {
    const dbPath = getDataFilePath('price_db.json');
    if (!fs.existsSync(dbPath)) return null;

    // Single read — the file is ~250MB and must fit in RAM regardless.
    // We scan it once and reduce to year buckets.
    const raw = fs.readFileSync(dbPath, 'utf-8');
    const db = JSON.parse(raw) as Record<string, {
        manufacturer: string;
        article_number: string;
        history?: { year: number; price: number }[];
    }>;

    // Accumulate totals per year
    const yearBuckets: Record<number, { sum: number; count: number }> = {};
    let totalArticles = 0;
    const mfrLower = manufacturer.toLowerCase();

    for (const item of Object.values(db)) {
        if (!item.manufacturer || item.manufacturer.toLowerCase() !== mfrLower) continue;
        if (!item.history || item.history.length === 0) continue;

        totalArticles++;

        for (const { year, price } of item.history) {
            // Filter invalid types and obvious Excel corruption artifacts (> €200,000)
            if (typeof price !== 'number' || price <= 0 || price > 200000) continue;
            if (!yearBuckets[year]) yearBuckets[year] = { sum: 0, count: 0 };
            yearBuckets[year].sum += price;
            yearBuckets[year].count++;
        }
    }

    if (totalArticles === 0) return null;

    // Sort by year ascending
    const yearlyData: YearlyAverage[] = Object.entries(yearBuckets)
        .map(([year, { sum, count }]) => ({
            year: parseInt(year),
            avgPrice: Math.round((sum / count) * 100) / 100,
            articleCount: count,
        }))
        .sort((a, b) => a.year - b.year);

    // Build a compact LLM context string
    const yearLines = yearlyData
        .map(y => `${y.year}: gemiddeld €${y.avgPrice} (${y.articleCount} prijspunten)`)
        .join('\n');

    const contextString =
        `=== PRIJSANALYSE: ${manufacturer} ===\n` +
        `Unieke artikelen in database: ${totalArticles}\n` +
        `Gemiddelde brutoprijzen per jaar:\n${yearLines}`;

    return { manufacturer, yearlyData, totalArticles, contextString };
}
