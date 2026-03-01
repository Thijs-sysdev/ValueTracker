/**
 * lib/ai/aggregator.ts
 *
 * "Detective AI" — Real-time business intelligence over the price database.
 *
 * v2: Supports granular queries:
 *   - Specific years only (e.g. "2025 vs 2026")
 *   - Per-category breakdown (e.g. "welke categorieën zijn gestegen")
 *   - Manufacturer-level slices as fallback
 */

import fs from 'fs';
import { getDataFilePath } from '@/lib/dataPath';

// ── Types ────────────────────────────────────────────────────────────────────

export interface YearlyAverage {
    year: number;
    avgPrice: number;
    articleCount: number;
}

export interface CategoryYearlyData {
    category: string;
    yearlyData: YearlyAverage[];
}

export interface AnalysisIntent {
    manufacturer: string;
    /** Years explicitly mentioned in the query (e.g. [2025, 2026]) */
    targetYears: number[];
    /** True if the user is asking for a per-category breakdown */
    categoryMode: boolean;
}

export interface AggregationResult {
    manufacturer: string;
    /** Only present when categoryMode = false */
    yearlyData?: YearlyAverage[];
    /** Only present when categoryMode = true */
    categoryData?: CategoryYearlyData[];
    totalArticles: number;
    /** Whether this result is a category comparison (suppresses the chart) */
    isCategoryMode: boolean;
    /** Formatted as a concise LLM-ready text summary */
    contextString: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TREND_KEYWORDS = [
    'trend', 'ontwikkeling', 'verandering', 'gestegen', 'gedaald',
    'prijshistorie', 'gemiddelde', 'historisch', 'over de jaren',
    'afgelopen', 'gestegen', 'vergeleken', 'tov', 't.o.v.', 'versus', 'vs'
];

const CATEGORY_KEYWORDS = [
    'categorie', 'categorieën', 'soort', 'soorten', 'type', 'typen',
    'groep', 'groepen', 'product', 'producten'
];

const KNOWN_MANUFACTURERS = [
    'Siemens', 'Allen Bradley', 'Allen-Bradley', 'Lenze', 'Schneider',
    'Phoenix Contact', 'Wago', 'Pepperl', 'Turck', 'Pilz', 'Beckhoff',
    'Danfoss', 'ABB', 'Omron', 'Mitsubishi', 'Fanuc', 'Bosch', 'SEW',
    'Rockwell', 'Eldon', 'Rittal'
];

// ── Intent Detection ──────────────────────────────────────────────────────────

/**
 * Parses the user's question into a structured AnalysisIntent.
 * Returns null if this is not a trend/analysis question.
 */
export function detectAnalysisIntent(question: string): AnalysisIntent | null {
    const lowerQ = question.toLowerCase();

    const hasTrendKeyword = TREND_KEYWORDS.some(k => lowerQ.includes(k));
    if (!hasTrendKeyword) return null;

    // Detect manufacturer
    let manufacturer: string | null = null;
    for (const mfr of KNOWN_MANUFACTURERS) {
        if (lowerQ.includes(mfr.toLowerCase())) {
            manufacturer = mfr;
            break;
        }
    }
    if (!manufacturer) return null;

    // Extract all 4-digit years >= 2000 (e.g. 2025, 2026)
    const yearMatches = question.match(/20\d{2}/g) ?? [];
    const targetYears = [...new Set(yearMatches.map(y => parseInt(y)))].sort();

    // Detect category mode
    const categoryMode = CATEGORY_KEYWORDS.some(k => lowerQ.includes(k));

    return { manufacturer, targetYears, categoryMode };
}

// ── Core Aggregator ───────────────────────────────────────────────────────────

/**
 * Scans price_db.json in one pass. Groups data based on the intent:
 *  - categoryMode=true  → group by category (+ year), filtered to targetYears
 *  - categoryMode=false → group by year only, filtered to targetYears
 */
export async function aggregateByManufacturer(
    intent: AnalysisIntent
): Promise<AggregationResult | null> {
    const { manufacturer, targetYears, categoryMode } = intent;

    const dbPath = getDataFilePath('price_db.json');
    if (!fs.existsSync(dbPath)) return null;

    const raw = fs.readFileSync(dbPath, 'utf-8');
    const db = JSON.parse(raw) as Record<string, {
        manufacturer: string;
        article_number: string;
        category?: string;
        history?: { year: number; price: number }[];
    }>;

    const mfrLower = manufacturer.toLowerCase();

    // ── Accumulator types ─────────────────────────────────────────────────────
    // For category mode: { [category]: { [year]: { sum, count } } }
    const catBuckets: Record<string, Record<number, { sum: number; count: number }>> = {};
    // For year mode: { [year]: { sum, count } }
    const yearBuckets: Record<number, { sum: number; count: number }> = {};
    let totalArticles = 0;

    // ── Single-pass scan ──────────────────────────────────────────────────────
    for (const item of Object.values(db)) {
        if (!item.manufacturer || item.manufacturer.toLowerCase() !== mfrLower) continue;
        if (!item.history || item.history.length === 0) continue;

        let articleCounted = false;

        for (const { year, price } of item.history) {
            // Filter corrupt data (> €200,000) and non-numeric
            if (typeof price !== 'number' || price <= 0 || price > 200000) continue;

            // Year filter — only care about targetYears if specified
            if (targetYears.length > 0 && !targetYears.includes(year)) continue;

            if (!articleCounted) {
                totalArticles++;
                articleCounted = true;
            }

            if (categoryMode) {
                const cat = (item.category ?? 'Overige').trim() || 'Overige';
                if (!catBuckets[cat]) catBuckets[cat] = {};
                if (!catBuckets[cat][year]) catBuckets[cat][year] = { sum: 0, count: 0 };
                catBuckets[cat][year].sum += price;
                catBuckets[cat][year].count++;
            } else {
                if (!yearBuckets[year]) yearBuckets[year] = { sum: 0, count: 0 };
                yearBuckets[year].sum += price;
                yearBuckets[year].count++;
            }
        }
    }

    if (totalArticles === 0) return null;

    // ── Build result ──────────────────────────────────────────────────────────

    if (!categoryMode) {
        // ── Standard mode: flat year array ────────────────────────────────────
        const yearlyData: YearlyAverage[] = Object.entries(yearBuckets)
            .map(([year, { sum, count }]) => ({
                year: parseInt(year),
                avgPrice: Math.round((sum / count) * 100) / 100,
                articleCount: count,
            }))
            .sort((a, b) => a.year - b.year);

        const yearLines = yearlyData
            .map(y => `${y.year}: gemiddeld €${y.avgPrice} (${y.articleCount} prijspunten)`)
            .join('\n');

        const contextString =
            `=== PRIJSANALYSE: ${manufacturer} ===\n` +
            `Unieke artikelen in database: ${totalArticles}\n` +
            `Gemiddelde brutoprijzen per jaar:\n${yearLines}`;

        return { manufacturer, yearlyData, totalArticles, isCategoryMode: false, contextString };
    }

    // ── Category mode: breakdown per category ──────────────────────────────
    const categoryData: CategoryYearlyData[] = Object.entries(catBuckets)
        .map(([category, yearMap]) => ({
            category,
            yearlyData: Object.entries(yearMap)
                .map(([year, { sum, count }]) => ({
                    year: parseInt(year),
                    avgPrice: Math.round((sum / count) * 100) / 100,
                    articleCount: count,
                }))
                .sort((a, b) => a.year - b.year),
        }))
        // Sort by category name for consistent output
        .sort((a, b) => a.category.localeCompare(b.category));

    // Build a rich LLM context block as a Markdown table
    const allYears = [...new Set(
        categoryData.flatMap(c => c.yearlyData.map(y => y.year))
    )].sort();

    const yearHeader = allYears.join(' | ');
    const tableHeader = `| Categorie | ${yearHeader} | Verandering |`;
    const tableSep = `| --- | ${allYears.map(() => '---').join(' | ')} | --- |`;

    const tableRows = categoryData.map(c => {
        const prices = allYears.map(yr => {
            const match = c.yearlyData.find(y => y.year === yr);
            return match ? `€${match.avgPrice}` : '—';
        });

        // Compute change between first and last available year
        const first = c.yearlyData[0]?.avgPrice;
        const last = c.yearlyData[c.yearlyData.length - 1]?.avgPrice;
        let change = '—';
        if (first && last && first !== last) {
            const pct = ((last - first) / first) * 100;
            change = `${pct > 0 ? '↑' : '↓'} ${Math.abs(pct).toFixed(1)}%`;
        } else if (first && last && first === last) {
            change = '→ Stabiel';
        }

        return `| ${c.category} | ${prices.join(' | ')} | ${change} |`;
    });

    const contextString =
        `=== PRIJSANALYSE: ${manufacturer} (per Categorie, jaren: ${allYears.join(', ')}) ===\n` +
        `Unieke artikelen in database: ${totalArticles}\n\n` +
        `${tableHeader}\n${tableSep}\n${tableRows.join('\n')}`;

    return { manufacturer, categoryData, totalArticles, isCategoryMode: true, contextString };
}
