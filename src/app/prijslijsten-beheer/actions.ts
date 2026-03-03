'use server';

import * as fs from 'fs';
import * as path from 'path';
import * as xlsx from 'xlsx';
import { exec } from 'child_process';
import { getPriceList, clearPriceListCache } from '@/lib/priceList';
import { getPriceListsDir, getDataFilePath } from '@/lib/dataPath';

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
    phasedOutIdx: number;
    successorIdx: number;
} | null {
    const articleWords = ['artikel', 'art', 'code', 'type', 'typ', 'bestel', 'reference', 'product', 'id nummer', 'mlfb', 'part no', 'part_no', 'partnumber', 'part number', 'sku', 'item code', 'item no', 'bestelnummer', 'bestel nr', 'materiaal', 'material'];
    const articleBlacklist = ['gewicht', 'afmeting', 'packing', 'verpakking', 'ean', 'upc', 'groep'];

    const successorWords = ['successor', 'succesor', 'opvolger', 'vervanger', 'vervangt door'];

    const priceWords = ['bruto', 'prijs', 'price', 'catalogusprijs', 'list price', 'listprice', 'msrp', 'list_price', 'brutoprijs', 'bruto prijs', 'retail price', 'base price', 'standard price'];
    // FIX 1: Blacklist '/100' so we don't accidentally pick the "Prijs/100" column if a "Prijs /stuk" column is also available
    const priceBlacklist = [
        'korting', 'netto', 'update', 'verhoging', 'eenheid', 'groep', 'datum', 'qty', 'quantity', 'scale',
        '/100', 'per 100', 'p/100', '100st', 'p100'
    ];

    // FIX 3: Detect "price unit" column (often used by Weidmuller for "List Price per 100")
    const priceUnitWords = ['price unit', 'prijs per', 'prijseenheid', 'per eenheid', 'aantal per prijs'];
    const phasedOutWords = ['uitgefaseerd', 'obsolete', 'uitloop', 'vervallen', 'status', 'phased out', 'lifecycle status', 'life cycle', 'eol', 'end of life', 'uitloopartikel', 'uitfaseer'];


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
            let possiblePhasedOutIdx = -1;
            let possibleSuccessorIdx = -1;

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
                if (possiblePhasedOutIdx === -1 && phasedOutWords.some(w => colHeader.includes(w))) {
                    possiblePhasedOutIdx = c;
                }
                if (possibleSuccessorIdx === -1 && successorWords.some(w => colHeader.includes(w))) {
                    possibleSuccessorIdx = c;
                }
            }

            if (possibleArtIdx !== -1 && possiblePriceCols.length > 0 && !possiblePriceCols.some(pc => pc.idx === possibleArtIdx)) {
                return {
                    data,
                    headerRowIdx: i,
                    artIdx: possibleArtIdx,
                    priceCols: possiblePriceCols,
                    priceUnitIdx: possiblePriceUnitIdx,
                    phasedOutIdx: possiblePhasedOutIdx,
                    successorIdx: possibleSuccessorIdx
                };
            }
        }
    }

    return null;
}

export async function getDatabaseStats() {
    // Load price DB stats (may be slow/unavailable for large OneDrive files)
    let totalItems = 0;
    let uniqueManufacturers = 0;
    let topManufacturers = '';
    try {
        clearPriceListCache();
        const db = getPriceList();
        const uniqueItems = new Set<string>();
        const manufacturers = new Set<string>();
        Object.values(db).forEach((item: any) => {
            if (item.manufacturer) manufacturers.add(item.manufacturer);
            if (item.article_number) uniqueItems.add(`${item.manufacturer}_${item.article_number}`);
        });
        totalItems = uniqueItems.size;
        uniqueManufacturers = manufacturers.size;
        const mList = Array.from(manufacturers);
        topManufacturers = mList.slice(0, 5).join(', ') + (mList.length > 5 ? '...' : '');
    } catch (e) {
        console.error('[getDatabaseStats] Failed to load price_db.json:', e);
    }

    // Load metadata independently — always shown even if price DB fails
    let metadata: any[] = [];
    try {
        const metaPath = getDataFilePath('price_db_meta.json');
        if (fs.existsSync(metaPath)) {
            metadata = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        }
    } catch (e) {
        console.error('[getDatabaseStats] Failed to load price_db_meta.json:', e);
    }

    return {
        success: true,
        totalItems,
        uniqueManufacturers,
        topManufacturers,
        metadata
    };
}

/**
 * Internal logic to process an Excel workbook and merge data into the given DB object.
 * Used by both uploadPriceListAction and reanalyzePriceListsAction.
 */
function processWorkbookInternal(workbook: xlsx.WorkBook, currentDb: any, fileName: string): {
    newItemsCount: number;
    updatedItemsCount: number;
    totalProcessed: number;
    processedYears: number[];
    defaultManufacturer: string;
} | null {
    const detected = detectPriceListColumns(workbook);
    if (!detected) return null;

    const { data, headerRowIdx, artIdx, priceCols, priceUnitIdx, phasedOutIdx, successorIdx } = detected;

    let newItemsCount = 0;
    let updatedItemsCount = 0;
    let totalProcessed = 0;

    let defaultManufacturer = "Onbekend";
    let detectedYear = new Date().getFullYear();

    const yearMatch = fileName.match(/(20\d{2})/);
    if (yearMatch) detectedYear = parseInt(yearMatch[1], 10);

    const mMatch = fileName.replace(/(20\d{2})/, '').match(/([a-zA-Z\s]+)(?=[\/\\][^\/\\]+\.xlsx?$)|([a-zA-Z\s]+)(?=\s|$|\.|_|-)/);
    if (mMatch && mMatch[0]) defaultManufacturer = mMatch[0].trim();

    const phasedOutTrueValues = ['ja', 'yes', 'true', '1', 'x', 'v', 'uitloop', 'vervallen', 'obsolete', 'uitgefaseerd', 'phased out'];

    const headers = data[headerRowIdx].map((h: any) => (h?.toString() || "").toLowerCase());
    const manufacturerIdx = headers.findIndex((h: string) => h.includes('fabrikant') || h.includes('merk') || h.includes('manufacturer'));

    for (let i = headerRowIdx + 1; i < data.length; i++) {
        const row = data[i];
        if (!row || !Array.isArray(row)) continue;

        const artCodeRaw = row[artIdx];
        if (artCodeRaw === undefined || artCodeRaw === null) continue;

        const artCode = artCodeRaw.toString().trim();
        if (!artCode) continue;

        let isPhasedOut = false;
        if (phasedOutIdx !== -1) {
            const poVal = row[phasedOutIdx];
            if (poVal) {
                const poStr = poVal.toString().trim().toLowerCase();
                if (phasedOutTrueValues.includes(poStr)) isPhasedOut = true;
            }
        }

        let unitDivisor = 1;
        if (priceUnitIdx !== -1) {
            const unitValRaw = row[priceUnitIdx];
            if (unitValRaw) {
                const unitVal = parseInt(unitValRaw.toString().replace(/[^0-9]/g, ''), 10);
                if (!isNaN(unitVal) && unitVal > 1) unitDivisor = unitVal;
            }
        }

        let successorArtCode: string | null = null;
        if (successorIdx !== -1) {
            const sVal = row[successorIdx];
            if (sVal) successorArtCode = sVal.toString().trim();
        }

        let itemProcessed = false;

        for (const pCol of priceCols) {
            const priceRaw = row[pCol.idx];
            if (priceRaw === undefined || priceRaw === null) continue;

            let parsedPrice = parseExcelPrice(priceRaw);
            if (isNaN(parsedPrice) || parsedPrice <= 0) continue;

            if (unitDivisor > 1) parsedPrice = parsedPrice / unitDivisor;

            const cleanArtCode = artCode.replace(/[^a-zA-Z0-9]/g, '');
            const manufacturer = manufacturerIdx !== -1 && row[manufacturerIdx] ? row[manufacturerIdx].toString() : defaultManufacturer;
            const isNewArticle = !currentDb[artCode] && (!cleanArtCode || !currentDb[cleanArtCode]);
            let isUpdate = false;
            const priceYearToUse = pCol.year !== null ? pCol.year : detectedYear;

            const addOrUpdateItem = (key: string) => {
                if (!currentDb[key]) {
                    currentDb[key] = {
                        manufacturer,
                        article_number: artCode,
                        history: [{ year: priceYearToUse, price: parsedPrice }]
                    };
                    if (isPhasedOut) currentDb[key].phased_out_year = detectedYear;
                } else {
                    const item = currentDb[key];
                    if (!item.history) {
                        item.history = [{ year: item.year || 2021, price: item.gross_price }];
                        delete item.gross_price;
                        delete item.year;
                    }
                    if (isPhasedOut) item.phased_out_year = detectedYear;

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

                const item = currentDb[key];
                if (isPhasedOut) item.phased_out_year = detectedYear;

                if (successorArtCode) {
                    item.successor = successorArtCode;
                    const cleanSuccessor = successorArtCode.replace(/[^a-zA-Z0-9]/g, '');
                    [successorArtCode, cleanSuccessor].forEach(sKey => {
                        if (sKey && currentDb[sKey]) currentDb[sKey].predecessor = artCode;
                    });
                }
            };

            addOrUpdateItem(artCode);
            if (cleanArtCode && cleanArtCode !== artCode) addOrUpdateItem(cleanArtCode);

            if (isNewArticle) newItemsCount++;
            else if (isUpdate) updatedItemsCount++;

            itemProcessed = true;
        }

        if (itemProcessed) totalProcessed++;
    }

    const processedYears = Array.from(new Set(priceCols.map((p: any) => p.year !== null ? p.year : detectedYear)));

    return { newItemsCount, updatedItemsCount, totalProcessed, processedYears, defaultManufacturer };
}

export async function uploadPriceListAction(formData: FormData) {
    try {
        const file = formData.get('file') as File;
        if (!file) return { success: false, error: "Geen bestand geüpload" };

        const buffer = await file.arrayBuffer();

        const priceListsDir = getPriceListsDir();
        if (!fs.existsSync(priceListsDir)) fs.mkdirSync(priceListsDir, { recursive: true });

        let savedFileName = file.name;
        let fileIndex = 1;
        while (fs.existsSync(path.join(priceListsDir, savedFileName))) {
            const ext = path.extname(file.name);
            const nameWithoutExt = path.basename(file.name, ext);
            savedFileName = `${nameWithoutExt}_${fileIndex}${ext}`;
            fileIndex++;
        }
        const savedFilePath = path.join(priceListsDir, savedFileName);
        fs.writeFileSync(savedFilePath, Buffer.from(buffer));

        const workbook = xlsx.read(buffer, { type: 'buffer' });

        const dbPath = getDataFilePath('price_db.json');
        let currentDb: any = {};
        if (fs.existsSync(dbPath)) currentDb = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));

        const result = processWorkbookInternal(workbook, currentDb, file.name);
        if (!result) {
            return { success: false, error: "Kon de kolommen voor 'Artikelnummer' en 'Brutoprijs' niet automatisch detecteren in de eerste 30 rijen van de tabbladen." };
        }

        const { newItemsCount, updatedItemsCount, totalProcessed, processedYears, defaultManufacturer } = result;

        const dataDir = path.dirname(dbPath);
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        fs.writeFileSync(dbPath, JSON.stringify(currentDb, null, 2));

        if (totalProcessed > 0) {
            const metaPath = getDataFilePath('price_db_meta.json');
            let metaLog: any[] = [];
            if (fs.existsSync(metaPath)) metaLog = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));

            for (const y of processedYears) {
                metaLog.unshift({
                    id: crypto.randomUUID(),
                    fileName: savedFileName,
                    originalFileName: file.name,
                    manufacturer: defaultManufacturer,
                    year: y,
                    itemCount: newItemsCount,
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

        const { data, headerRowIdx, artIdx, priceCols, priceUnitIdx, phasedOutIdx, successorIdx } = detected;

        // Detect year & manufacturer from filename
        let detectedYear = new Date().getFullYear();
        const yearMatch = file.name.match(/(20\d{2})/);
        if (yearMatch) detectedYear = parseInt(yearMatch[1], 10);

        let defaultManufacturer = "Onbekend";
        const mMatch = file.name.replace(/(20\d{2})/, '').match(/([a-zA-Z\s]+)(?=[\/\\][^\/\\]+\.xlsx?$)|([a-zA-Z\s]+)(?=\s|$|\.|_|-)/);
        if (mMatch && mMatch[0]) defaultManufacturer = mMatch[0].trim();

        // Check metadata for existing year + manufacturer combo
        const metaPath = getDataFilePath('price_db_meta.json');
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
        const dbPath = getDataFilePath('price_db.json');
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

export async function openPriceListAction(fileName: string): Promise<{ success: boolean; error?: string }> {
    try {
        if (!fileName) return { success: false, error: "Geen bestandsnaam opgegeven." };

        const priceListsDir = getPriceListsDir();
        const filePath = path.join(priceListsDir, fileName);

        if (!fs.existsSync(filePath)) {
            return { success: false, error: `Bestand niet gevonden in de geconfigureerde map:\n${filePath}` };
        }

        // Use child_process to open the file with the default OS application
        return new Promise((resolve) => {
            let command = '';
            if (process.platform === 'win32') {
                command = `start "" "${filePath}"`;
            } else if (process.platform === 'darwin') {
                command = `open "${filePath}"`;
            } else {
                command = `xdg-open "${filePath}"`;
            }

            exec(command, (error) => {
                if (error) {
                    console.error("Error opening file:", error);
                    resolve({ success: false, error: `Kon bestand niet openen: ${error.message}` });
                } else {
                    resolve({ success: true });
                }
            });
        });
    } catch (error) {
        console.error("openPriceListAction error", error);
        return { success: false, error: error instanceof Error ? error.message : "Onbekende fout bij het openen van het bestand." };
    }
}

export async function updateManufacturerAction(metaId: string, newManufacturer: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
        const metaPath = getDataFilePath('price_db_meta.json');
        if (!fs.existsSync(metaPath)) return { success: false, error: "Metadata bestand niet gevonden." };

        const metaLog: any[] = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        const metaEntryIndex = metaLog.findIndex(m => m.id === metaId);

        if (metaEntryIndex === -1) return { success: false, error: "Prijslijst niet gevonden in metadata." };

        const oldManufacturer = metaLog[metaEntryIndex].manufacturer;
        const targetFileName = metaLog[metaEntryIndex].fileName;

        if (oldManufacturer === newManufacturer) {
            return { success: true, message: "Merk is al gelijk." };
        }

        // 1. Update metadata log
        metaLog[metaEntryIndex].manufacturer = newManufacturer;
        fs.writeFileSync(metaPath, JSON.stringify(metaLog, null, 2));

        // 2. Update all corresponding items in price_db.json
        const dbPath = getDataFilePath('price_db.json');
        if (fs.existsSync(dbPath)) {
            const currentDb = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
            let updatedCount = 0;

            // We update items where the manufacturer matches the old one.
            // Ideally we'd only update items that were actually in the specific file,
            // but since we only group by manufacturer and year, updating by oldManufacturer is the safest way
            // to ensure consistency across the board for this specific incorrectly named brand.
            Object.values(currentDb).forEach((item: any) => {
                if (item.manufacturer === oldManufacturer) {
                    item.manufacturer = newManufacturer;
                    updatedCount++;
                }
            });

            if (updatedCount > 0) {
                fs.writeFileSync(dbPath, JSON.stringify(currentDb, null, 2));
            }
            return { success: true, message: `Merk bijgewerkt. ${updatedCount} artikelen in de database zijn ook hernoemd naar '${newManufacturer}'.` };
        }

        return { success: true, message: "Merk bijgewerkt in metadata." };

    } catch (error) {
        console.error("updateManufacturerAction error", error);
        return { success: false, error: error instanceof Error ? error.message : "Onbekende fout bij het bijwerken van het merk." };
    }
}

export async function searchArticleHistory(query: string): Promise<any | null> {
    const trimmed = query.trim();
    const cleanQuery = trimmed.replace(/[^a-zA-Z0-9]/g, '');
    if (!trimmed) return null;

    try {
        const dbPath = getDataFilePath('price_db.json');
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

export async function reanalyzePriceListsAction(): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
        const priceListsDir = getPriceListsDir();
        if (!fs.existsSync(priceListsDir)) {
            return { success: false, error: "Map met prijslijsten bestaat niet." };
        }

        const files = fs.readdirSync(priceListsDir).filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'));
        if (files.length === 0) {
            return { success: false, error: "Geen Excel bestanden gevonden in de map." };
        }

        const dbPath = getDataFilePath('price_db.json');
        let currentDb: any = {};
        if (fs.existsSync(dbPath)) currentDb = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));

        const metaPath = getDataFilePath('price_db_meta.json');
        let metaLog: any[] = [];
        if (fs.existsSync(metaPath)) metaLog = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));

        let totalProcessedCount = 0;
        let fileCount = 0;
        const skippedFiles: string[] = [];

        for (const fileName of files) {
            try {
                const filePath = path.join(priceListsDir, fileName);
                const buffer = fs.readFileSync(filePath);
                const workbook = xlsx.read(buffer, { type: 'buffer' });

                const result = processWorkbookInternal(workbook, currentDb, fileName);
                if (!result || result.totalProcessed === 0) continue;

                totalProcessedCount += result.totalProcessed;
                fileCount++;

                // Update metadata: update existing entries instead of duplicating
                for (const y of result.processedYears) {
                    const existingEntry = metaLog.find((m: any) => m.fileName === fileName && m.year === y && m.manufacturer === result.defaultManufacturer);
                    if (existingEntry) {
                        existingEntry.itemCount = result.newItemsCount;
                        existingEntry.addedAt = new Date().toISOString();
                    } else {
                        metaLog.unshift({
                            id: crypto.randomUUID(),
                            fileName,
                            originalFileName: fileName,
                            manufacturer: result.defaultManufacturer,
                            year: y,
                            itemCount: result.newItemsCount,
                            addedAt: new Date().toISOString()
                        });
                    }
                }
            } catch (fileError) {
                console.error(`Error processing file ${fileName}:`, fileError);
                skippedFiles.push(fileName);
            }
        }

        if (totalProcessedCount > 0) {
            // FINAL PASS: Reconcile all successor/predecessor links across the entire database
            // This ensures that even if articles were processed out of order, all links are established.
            console.log(`[reanalyze] Final reconciliation pass for ${Object.keys(currentDb).length} items...`);
            Object.values(currentDb).forEach((item: any) => {
                if (item.successor) {
                    const succKey = item.successor;
                    const cleanSuccKey = succKey.replace(/[^a-zA-Z0-9]/g, '');

                    // If the successor exists in the DB, set its predecessor link
                    if (currentDb[succKey]) {
                        currentDb[succKey].predecessor = item.article_number;
                    } else if (cleanSuccKey && currentDb[cleanSuccKey]) {
                        currentDb[cleanSuccKey].predecessor = item.article_number;
                    }
                }
            });

            fs.writeFileSync(dbPath, JSON.stringify(currentDb, null, 2));
            fs.writeFileSync(metaPath, JSON.stringify(metaLog, null, 2));
            clearPriceListCache();

            let msg = `Re-analyse voltooid! ${fileCount} bestanden verwerkt, ${totalProcessedCount} artikel-entries bijgewerkt.`;
            if (skippedFiles.length > 0) {
                msg += ` (${skippedFiles.length} bestanden overgeslagen, mogelijk beveiligd of corrupt)`;
            }

            return {
                success: true,
                message: msg
            };
        } else {
            let err = "Geen bruikbare data gevonden in de bestanden.";
            if (skippedFiles.length > 0) {
                err += ` (${skippedFiles.length} bestanden overgeslagen vanwege fouten/beveiliging)`;
            }
            return { success: false, error: err };
        }
    } catch (error) {
        console.error("Re-analyze error", error);
        return { success: false, error: error instanceof Error ? error.message : "Er trad een fout op tijdens de re-analyse." };
    }
}
