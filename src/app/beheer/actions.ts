'use server';

import * as fs from 'fs';
import * as path from 'path';
import * as xlsx from 'xlsx';
import { getPriceList } from '@/lib/priceList';

const dbPath = path.join(process.cwd(), 'data', 'price_db.json');

// Helper to clean price strings
function parseExcelPrice(priceRaw: any): number {
    if (!priceRaw) return NaN;
    let priceStr = priceRaw.toString().replace(/[^0-9,\.]/g, '');
    if (priceStr.includes(',') && priceStr.includes('.')) {
        if (priceStr.lastIndexOf(',') > priceStr.lastIndexOf('.')) {
            priceStr = priceStr.replace(/\./g, '').replace(',', '.');
        } else {
            priceStr = priceStr.replace(/,/g, '');
        }
    } else if (priceStr.includes(',')) {
        priceStr = priceStr.replace(',', '.');
    }
    return parseFloat(priceStr);
}

// Shared helper to find the right headers across all sheets
function detectPriceListColumns(workbook: xlsx.WorkBook): {
    data: any[][];
    headerRowIdx: number;
    artIdx: number;
    priceCols: { idx: number, year: number | null }[];
    priceUnitIdx: number;
} | null {
    const articleWords = ['artikel', 'art', 'code', 'type', 'typ', 'bestel', 'reference', 'product', 'id nummer', 'mlfb'];
    const articleBlacklist = ['gewicht', 'afmeting', 'packing', 'verpakking', 'succesor', 'successor', 'ean', 'upc', 'groep'];

    const priceWords = ['bruto', 'prijs', 'price', 'catalogusprijs', 'list price', 'listprice'];
    // FIX 1: Blacklist '/100' so we don't accidentally pick the "Prijs/100" column if a "Prijs /stuk" column is also available
    const priceBlacklist = [
        'korting', 'netto', 'update', 'verhoging', 'eenheid', 'groep', 'datum', 'qty', 'quantity', 'scale',
        '/100', 'per 100', 'p/100', '100st', 'p100'
    ];

    // FIX 3: Detect "price unit" column (often used by Weidmuller for "List Price per 100")
    const priceUnitWords = ['price unit', 'prijs per', 'prijseenheid', 'per eenheid', 'aantal per prijs'];

    // FIX 2: Scan ALL sheets, not just the first one
    for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: null });

        for (let i = 0; i < Math.min(30, data.length); i++) {
            const row = data[i];
            if (!Array.isArray(row)) continue;

            const strCols = row.map(c => typeof c === 'string' ? c.toLowerCase() : '');
            let possibleArtIdx = -1;
            const possiblePriceCols: { idx: number, year: number | null }[] = [];
            let possiblePriceUnitIdx = -1;

            for (let c = 0; c < strCols.length; c++) {
                const colHeader = strCols[c];
                if (!colHeader || colHeader.length > 80) continue;

                if (articleWords.some(w => colHeader.includes(w))) {
                    if (possibleArtIdx === -1 && !articleBlacklist.some(b => colHeader.includes(b))) possibleArtIdx = c;
                }
                if (priceWords.some(w => colHeader.includes(w))) {
                    if (!priceBlacklist.some(b => colHeader.includes(b))) {
                        // Extract year from header, if present
                        let colYear: number | null = null;
                        const yearMatch = colHeader.match(/(20\d{2})/);
                        if (yearMatch) {
                            colYear = parseInt(yearMatch[1], 10);
                        }
                        possiblePriceCols.push({ idx: c, year: colYear });
                    }
                }
                if (possiblePriceUnitIdx === -1 && priceUnitWords.some(w => colHeader.includes(w))) {
                    possiblePriceUnitIdx = c;
                }
            }

            if (possibleArtIdx !== -1 && possiblePriceCols.length > 0 && !possiblePriceCols.some(pc => pc.idx === possibleArtIdx)) {
                return {
                    data,
                    headerRowIdx: i,
                    artIdx: possibleArtIdx,
                    priceCols: possiblePriceCols,
                    priceUnitIdx: possiblePriceUnitIdx
                };
            }
        }
    }

    return null;
}

export async function getDatabaseStats() {
    try {
        const db = getPriceList();

        const uniqueItems = new Set<string>();
        const manufacturers = new Set<string>();

        Object.values(db).forEach((item: any) => {
            if (item.manufacturer) manufacturers.add(item.manufacturer);
            if (item.article_number) uniqueItems.add(`${item.manufacturer}_${item.article_number}`);
        });

        const totalItems = uniqueItems.size;

        const mList = Array.from(manufacturers);
        const topManufacturers = mList.slice(0, 5).join(', ') + (mList.length > 5 ? '...' : '');

        // Load metadata
        const metaPath = path.join(process.cwd(), 'data', 'price_db_meta.json');
        let metadata = [];
        if (fs.existsSync(metaPath)) {
            try {
                metadata = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
            } catch (_e) {
                console.error("Failed to parse metadata", _e);
            }
        }

        return {
            success: true,
            totalItems,
            uniqueManufacturers: manufacturers.size,
            topManufacturers,
            metadata
        };
    } catch {
        return { success: false, error: "Kon database statistieken niet laden." };
    }
}

export async function uploadPriceListAction(formData: FormData) {
    try {
        const file = formData.get('file') as File;
        if (!file) return { success: false, error: "Geen bestand geüpload" };

        const buffer = await file.arrayBuffer();
        const workbook = xlsx.read(buffer, { type: 'buffer' });

        const detected = detectPriceListColumns(workbook);
        if (!detected) {
            return { success: false, error: "Kon de kolommen voor 'Artikelnummer' en 'Brutoprijs' niet automatisch detecteren in de eerste 30 rijen van de tabbladen." };
        }

        const { data, headerRowIdx, artIdx, priceCols, priceUnitIdx } = detected;

        // 2. Extract Data
        let newItemsCount = 0;
        let updatedItemsCount = 0;
        let totalProcessed = 0;

        // Load existing db
        let currentDb: any = {};
        if (fs.existsSync(dbPath)) {
            currentDb = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
        }

        // Guess manufacturer and year from filename
        let defaultManufacturer = "Onbekend";
        let detectedYear = new Date().getFullYear();

        const yearMatch = file.name.match(/(20\d{2})/);
        if (yearMatch) detectedYear = parseInt(yearMatch[1], 10);

        const mMatch = file.name.replace(/(20\d{2})/, '').match(/([a-zA-Z\s]+)(?=[\/\\][^\/\\]+\.xlsx?$)|([a-zA-Z\s]+)(?=\s|$|\.|_|-)/);
        if (mMatch && mMatch[0]) defaultManufacturer = mMatch[0].trim();

        // Check if there is a Fabrikant column explicitly
        const headers = data[headerRowIdx].map((h: any) => (h?.toString() || "").toLowerCase());
        const manufacturerIdx = headers.findIndex((h: string) => h.includes('fabrikant') || h.includes('merk') || h.includes('manufacturer'));

        for (let i = headerRowIdx + 1; i < data.length; i++) {
            const row = data[i];
            if (!row || !Array.isArray(row)) continue;

            const artCodeRaw = row[artIdx];
            if (artCodeRaw === undefined || artCodeRaw === null) continue;

            const artCode = artCodeRaw.toString().trim();
            if (!artCode) continue;

            // Adjust base price if a per-unit divisor column is present and valid
            let unitDivisor = 1;
            if (priceUnitIdx !== -1) {
                const unitValRaw = row[priceUnitIdx];
                if (unitValRaw) {
                    const unitVal = parseInt(unitValRaw.toString().replace(/[^0-9]/g, ''), 10);
                    if (!isNaN(unitVal) && unitVal > 1) {
                        unitDivisor = unitVal;
                    }
                }
            }

            let itemProcessed = false;

            // Loop through all detected price columns
            for (const pCol of priceCols) {
                const priceRaw = row[pCol.idx];
                if (priceRaw === undefined || priceRaw === null) continue;

                let parsedPrice = parseExcelPrice(priceRaw);
                if (isNaN(parsedPrice) || parsedPrice <= 0) continue;

                if (unitDivisor > 1) {
                    parsedPrice = parsedPrice / unitDivisor;
                }
                const cleanArtCode = artCode.replace(/[^a-zA-Z0-9]/g, '');

                const manufacturer = manufacturerIdx !== -1 && row[manufacturerIdx] ? row[manufacturerIdx].toString() : defaultManufacturer;

                const isNewArticle = !currentDb[artCode] && (!cleanArtCode || !currentDb[cleanArtCode]);
                let isUpdate = false;
                const priceYearToUse = pCol.year !== null ? pCol.year : detectedYear;

                const addOrUpdateItem = (key: string) => {
                    if (!currentDb[key]) {
                        currentDb[key] = {
                            manufacturer: manufacturer,
                            article_number: artCode,
                            history: [{ year: priceYearToUse, price: parsedPrice }]
                        };
                    } else {
                        const item = currentDb[key];
                        // If it's a legacy record without history, migrate it
                        if (!item.history) {
                            item.history = [{ year: item.year || 2021, price: item.gross_price }];
                            delete item.gross_price;
                            delete item.year;
                        }

                        const existingYear = item.history.find((h: any) => h.year === priceYearToUse);
                        if (existingYear) {
                            if (existingYear.price !== parsedPrice) isUpdate = true;
                            existingYear.price = parsedPrice;
                        } else {
                            item.history.push({ year: priceYearToUse, price: parsedPrice });
                            item.history.sort((a: any, b: any) => a.year - b.year);
                            isUpdate = true;
                        }
                    }
                };

                addOrUpdateItem(artCode);
                if (cleanArtCode && cleanArtCode !== artCode) {
                    addOrUpdateItem(cleanArtCode);
                }

                if (isNewArticle) {
                    newItemsCount++;
                } else if (isUpdate) {
                    updatedItemsCount++;
                }

                itemProcessed = true;
            }

            if (itemProcessed) {
                totalProcessed++;
            }
        }

        // 3. Save to disk
        const dataDir = path.dirname(dbPath);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        fs.writeFileSync(dbPath, JSON.stringify(currentDb, null, 2));

        let processedYears: number[] = [];

        // 4. Update Metadata Log
        if (totalProcessed > 0) {
            const metaPath = path.join(dataDir, 'price_db_meta.json');
            let metaLog: any[] = [];
            if (fs.existsSync(metaPath)) {
                metaLog = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
            }

            // Add a log entry for each unique year processed
            processedYears = Array.from(new Set(priceCols.map((p: any) => p.year !== null ? p.year : detectedYear)));

            for (const y of processedYears) {
                metaLog.unshift({
                    id: crypto.randomUUID(),
                    fileName: file.name,
                    manufacturer: defaultManufacturer,
                    year: y,
                    itemCount: newItemsCount, // Note: this represents new items across the whole file upload
                    addedAt: new Date().toISOString()
                });
            }

            fs.writeFileSync(metaPath, JSON.stringify(metaLog, null, 2));
        }

        return {
            success: true,
            message: `Prijslijst succesvol verwerkt! ${newItemsCount} nieuwe artikelen toegevoegd, ${updatedItemsCount} bestaande artikelen overschreven met actuele prijzen. (${processedYears.length} jaren gedetecteerd)`
        };
    } catch (error) {
        console.error("Database upload error", error);
        return { success: false, error: error instanceof Error ? error.message : "Er trad een onbekende fout op tijdens het inlezen van de prijslijst." };
    }
}

export async function checkPriceListAction(formData: FormData): Promise<{
    success: boolean;
    error?: string;
    // validation results
    yearAlreadyExists?: boolean;
    years?: number[]; // Updated to return all detected years
    manufacturer?: string;
    totalArticles?: number;
    newArticlesCount?: number;
    existingUploadDates?: string[]; // Updated for multiple existing dates
}> {
    try {
        const file = formData.get('file') as File;
        if (!file) return { success: false, error: "Geen bestand geüpload" };

        const buffer = await file.arrayBuffer();
        const workbook = xlsx.read(buffer, { type: 'buffer' });
        const detected = detectPriceListColumns(workbook);
        if (!detected) {
            return { success: false, error: "Kon de kolommen voor 'Artikelnummer' en 'Brutoprijs' niet automatisch detecteren." };
        }

        const { data, headerRowIdx, artIdx, priceCols, priceUnitIdx } = detected;

        // Detect year & manufacturer from filename
        let detectedYear = new Date().getFullYear();
        const yearMatch = file.name.match(/(20\d{2})/);
        if (yearMatch) detectedYear = parseInt(yearMatch[1], 10);

        let defaultManufacturer = "Onbekend";
        const mMatch = file.name.replace(/(20\d{2})/, '').match(/([a-zA-Z\s]+)(?=[\/\\][^\/\\]+\.xlsx?$)|([a-zA-Z\s]+)(?=\s|$|\.|_|-)/);
        if (mMatch && mMatch[0]) defaultManufacturer = mMatch[0].trim();

        // Check metadata for existing year + manufacturer combo
        const metaPath = path.join(process.cwd(), 'data', 'price_db_meta.json');
        const existingUploadDates: string[] = [];

        const detectedYears = Array.from(new Set(priceCols.map((p: any) => p.year !== null ? p.year : detectedYear)));

        if (fs.existsSync(metaPath)) {
            try {
                const metaLog: any[] = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
                for (const y of detectedYears) {
                    const existing = metaLog.find(m => m.year === y && m.manufacturer === defaultManufacturer);
                    if (existing) existingUploadDates.push(existing.addedAt);
                }
            } catch { /* ignore */ }
        }

        // Load existing DB to count new articles
        let currentDb: any = {};
        if (fs.existsSync(dbPath)) {
            currentDb = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
        }

        let totalArticles = 0;
        let newArticlesCount = 0;
        const seenNew = new Set<string>();

        for (let i = headerRowIdx + 1; i < data.length; i++) {
            const row = data[i];
            if (!row || !Array.isArray(row)) continue;
            const artCodeRaw = row[artIdx];
            if (artCodeRaw == null) continue;
            const artCode = artCodeRaw.toString().trim();
            if (!artCode) continue;

            let unitDivisor = 1;
            if (priceUnitIdx !== -1) {
                const unitValRaw = row[priceUnitIdx];
                if (unitValRaw) {
                    const unitVal = parseInt(unitValRaw.toString().replace(/[^0-9]/g, ''), 10);
                    if (!isNaN(unitVal) && unitVal > 1) {
                        unitDivisor = unitVal;
                    }
                }
            }

            let itemProcessed = false;

            for (const pCol of priceCols) {
                const priceRaw = row[pCol.idx];
                if (priceRaw == null) continue;

                let parsedPrice = parseExcelPrice(priceRaw);
                if (isNaN(parsedPrice) || parsedPrice <= 0) continue;

                if (unitDivisor > 1) {
                    parsedPrice = parsedPrice / unitDivisor;
                }

                itemProcessed = true;
                const cleanCode = artCode.replace(/[^a-zA-Z0-9]/g, '');
                if (!currentDb[artCode] && (!cleanCode || !currentDb[cleanCode])) {
                    const lookupKey = cleanCode || artCode.toLowerCase();
                    if (!seenNew.has(lookupKey)) {
                        newArticlesCount++;
                        seenNew.add(lookupKey);
                    }
                }
            }

            if (itemProcessed) {
                totalArticles++;
            }
        }

        return {
            success: true,
            yearAlreadyExists: existingUploadDates.length > 0,
            existingUploadDates,
            years: detectedYears,
            manufacturer: defaultManufacturer,
            totalArticles,
            newArticlesCount,
        };
    } catch (error) {
        console.error("checkPriceListAction error", error);
        return { success: false, error: error instanceof Error ? error.message : "Onbekende fout bij controle." };
    }
}

export async function searchArticleHistory(query: string): Promise<any | null> {
    const trimmed = query.trim();
    const cleanQuery = trimmed.replace(/[^a-zA-Z0-9]/g, '');
    if (!trimmed) return null;

    try {
        const dbPath = path.join(process.cwd(), 'data', 'price_db.json');
        if (!fs.existsSync(dbPath)) return null;

        const dbRaw = fs.readFileSync(dbPath, 'utf-8');
        const db = JSON.parse(dbRaw);
        const allKeys = Object.keys(db);

        // 1. Exact matches
        let result = db[trimmed] || db[cleanQuery];

        // 2. Case-insensitive exact match
        if (!result) {
            const lowerQuery = trimmed.toLowerCase();
            const exactKey = allKeys.find(k => k.toLowerCase() === lowerQuery);
            if (exactKey) result = db[exactKey];
        }

        // 3. Prefix-based fuzzy match — use the longest prefix that yields results
        if (!result && trimmed.length >= 6) {
            // Try progressively shorter prefixes until we find a match
            for (let prefixLen = trimmed.length; prefixLen >= 6; prefixLen--) {
                const prefix = trimmed.substring(0, prefixLen).toLowerCase();
                const fuzzyMatches = allKeys.filter(k => k.toLowerCase().startsWith(prefix));
                if (fuzzyMatches.length > 0) {
                    // Pick the closest match (shortest key = most generic)
                    fuzzyMatches.sort((a, b) => a.length - b.length);
                    result = db[fuzzyMatches[0]];
                    if (result) {
                        result._fuzzy_matched_key = fuzzyMatches[0];
                        result._fuzzy_alternatives = fuzzyMatches.slice(0, 5);
                    }
                    break;
                }
            }
        }

        if (result) {
            // Migrate legacy format
            if (!result.history) {
                result.history = [{ year: result.year || 2021, price: result.gross_price }];
            }
            return result;
        }

        return null;
    } catch (e) {
        console.error("Failed to search article history:", e);
        return null;
    }
}
