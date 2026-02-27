import * as fs from 'fs';
import { PriceReference } from './types';
import { getDataFilePath } from './dataPath';

// In a real production app, this would be a database.
// For now, we load and cache the JSON lookup in memory during the server lifecycle.
let cachedPriceList: Record<string, PriceReference> | null = null;
let loadAttempted = false;

export function clearPriceListCache() {
    cachedPriceList = null;
    loadAttempted = false;
}

export function getPriceList(): Record<string, PriceReference> {
    if (cachedPriceList || loadAttempted) {
        return cachedPriceList || {};
    }

    loadAttempted = true;
    cachedPriceList = {};

    const filePath = getDataFilePath('price_db.json');

    try {
        if (!fs.existsSync(filePath)) {
            console.warn(`Compiled Price DB not found at ${filePath}. Please run the generic compiler script.`);
            return cachedPriceList;
        }

        const rawData = fs.readFileSync(filePath, 'utf-8');
        cachedPriceList = JSON.parse(rawData);

        console.log(`Successfully loaded ${Object.keys(cachedPriceList!).length} reference prices from the unified database.`);
    } catch (e) {
        console.error("Failed to parse the unified price_db.json:", e);
    }

    return cachedPriceList || {};
}

export function lookupPrice(articleNumber: string, targetYear: number): PriceReference | null {
    const list = getPriceList() as any;
    const cleanNumber = articleNumber.replace(/[^a-zA-Z0-9]/g, '');

    const record = list[articleNumber] || list[cleanNumber];
    if (!record) return null;

    // Handle legacy items that might not have the new history array
    const history = record.history || [{ year: record.year || 2021, price: record.gross_price }];

    if (history.length === 0) return null;

    // Exact match
    const exactMatch = history.find((h: any) => h.year === targetYear);
    if (exactMatch) {
        return {
            manufacturer: record.manufacturer,
            article_number: record.article_number,
            gross_price: exactMatch.price,
            year: targetYear,
            phased_out_year: record.phased_out_year
        };
    }

    // Sort to be safe, should already be sorted
    history.sort((a: any, b: any) => a.year - b.year);

    // Find closest before and after
    let before: any = null;
    let after: any = null;

    for (const entry of history) {
        if (entry.year < targetYear) before = entry;
        if (entry.year > targetYear && !after) after = entry;
    }

    if (before && after) {
        // Interpolate
        const yearDiff = after.year - before.year;
        const priceDiff = after.price - before.price;
        const avgYearlyChange = priceDiff / yearDiff;
        const estimatedPrice = before.price + (avgYearlyChange * (targetYear - before.year));

        return {
            manufacturer: record.manufacturer,
            article_number: record.article_number,
            gross_price: Math.round(estimatedPrice * 100) / 100, // round to 2 decimals
            year: targetYear,
            is_interpolated: true,
            price_note: `✅ Geïnterpoleerd tussen ${before.year} (€${before.price}) en ${after.year} (€${after.price})`,
            phased_out_year: record.phased_out_year
        };
    } else {
        // Fallback to closest available
        const closestFallback = before || after;
        return {
            manufacturer: record.manufacturer,
            article_number: record.article_number,
            gross_price: closestFallback.price,
            year: targetYear,
            is_fallback: true,
            price_note: `⚠️ Geen data voor ${targetYear}. Historische prijs uit ${closestFallback.year} gebruikt (€${closestFallback.price}).`,
            phased_out_year: record.phased_out_year
        };
    }
}

export function addLearnedPrices(newPrices: { manufacturer: string, article_number: string, year: number, price: number }[]) {
    if (!newPrices || newPrices.length === 0) return;

    const list = getPriceList() as any;
    const filePath = getDataFilePath('price_db.json');
    let updatedCount = 0;

    for (const newPrice of newPrices) {
        const { manufacturer, article_number, year, price } = newPrice;
        if (!article_number) continue;

        const cleanNumber = article_number.replace(/[^a-zA-Z0-9]/g, '');

        // Helper to update a specific key
        const updateOrAddRecord = (key: string) => {
            if (!key) return;

            if (!list[key]) {
                // New record
                list[key] = {
                    manufacturer: manufacturer || "Onbekend",
                    article_number: article_number,
                    history: [{ year, price }]
                };
                updatedCount++;
            } else {
                // Existing record
                const record = list[key];

                // Migrate legacy
                if (!record.history) {
                    record.history = [{ year: record.year || 2021, price: record.gross_price }];
                    delete record.gross_price;
                    delete record.year;
                }

                const existingYear = record.history.find((h: any) => h.year === year);
                if (existingYear) {
                    if (existingYear.price !== price) {
                        existingYear.price = price;
                        updatedCount++;
                    }
                } else {
                    record.history.push({ year, price });
                    record.history.sort((a: any, b: any) => a.year - b.year);
                    updatedCount++;
                }
            }
        };

        updateOrAddRecord(article_number);
        if (cleanNumber && cleanNumber !== article_number) {
            updateOrAddRecord(cleanNumber);
        }
    }

    if (updatedCount > 0) {
        try {
            fs.writeFileSync(filePath, JSON.stringify(list, null, 2));
            console.log(`Auto-learned ${updatedCount} price entries and saved to database.`);
        } catch (e) {
            console.error("Failed to save auto-learned prices to database:", e);
        }
    }
}
