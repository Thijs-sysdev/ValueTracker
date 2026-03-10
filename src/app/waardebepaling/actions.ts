'use server';

import * as xlsx from 'xlsx';
import { ValuationInput, ValuationOutput, HistoryItem, PriceUpdateCandidate } from '@/lib/types';
import { calculateValuation } from '@/lib/valuation';
import { lookupPrice, addLearnedPrices } from '@/lib/priceList';
import { saveHistory } from '@/lib/history';
import { getConfigMatrix } from '@/lib/config';
// @ts-expect-error: xlsx-populate does not have official types
import XlsxPopulate from 'xlsx-populate';

export async function processValuationFile(formData: FormData): Promise<{
    success: boolean;
    data?: ValuationOutput[];
    data_with_updates?: ValuationOutput[];
    price_update_candidates?: PriceUpdateCandidate[];
    error?: string;
}> {
    try {
        const file = formData.get('file') as File;
        if (!file) {
            return { success: false, error: "No file uploaded" };
        }

        const buffer = await file.arrayBuffer();
        const workbook = xlsx.read(buffer, { type: 'buffer' });

        // Try to find the correct sheet and header row
        // The data could be on 'Invoer' or 'Artikel lijst' or anywhere else.
        let targetData: any[][] | null = null;
        let headerRowIdx = -1;

        for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            const data = xlsx.utils.sheet_to_json<any[]>(sheet, { header: 1 });

            // Detect headers heuristically looking through the first 30 rows
            for (let i = 0; i < Math.min(30, data.length); i++) {
                const row = data[i];
                if (row && Array.isArray(row) && row.some(cell => typeof cell === 'string' && cell.toLowerCase().includes('artikel'))) {
                    headerRowIdx = i;
                    targetData = data;
                    break;
                }
            }
            if (targetData) break; // Found the right sheet
        }

        if (!targetData || headerRowIdx === -1) {
            return { success: false, error: "Con kon geen geldig tabblad of rij met een 'Artikelnummer' kolom vinden." };
        }

        const data = targetData;

        const headers = data[headerRowIdx].map(h => (h?.toString() || "").toLowerCase());

        // Map column indices
        const mappings = {
            manufacturer: headers.findIndex(h => h.includes('fabrikant') || h.includes('merk')),
            article_number: headers.findIndex(h => h.includes('artikel')),
            description: headers.findIndex(h => h.includes('omschrijving')),
            category: headers.findIndex(h => h.includes('categorie')),
            quantity: headers.findIndex(h => h.includes('aantal')),
            condition: headers.findIndex(h => h.includes('conditie')),
            purchase_date: headers.findIndex(h => h.includes('datum')),
            gross_price: headers.findIndex(h => h.includes('bruto')),
        };

        if (mappings.article_number === -1) {
            return { success: false, error: "Missing required 'Artikelnummer' column." };
        }

        const configMatrix = await getConfigMatrix();

        const results: ValuationOutput[] = [];
        const resultsWithUpdates: ValuationOutput[] = [];
        const priceUpdateCandidates: PriceUpdateCandidate[] = [];

        const newLearnedPrices: { manufacturer: string, article_number: string, year: number, price: number }[] = [];

        // Parse starting from row after header
        for (let i = headerRowIdx + 1; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length === 0 || !row[mappings.article_number]) continue;

            // Excel dates are sometimes numbers (days since 1900). We need to handle this.
            const dateVal = row[mappings.purchase_date];
            let isoDate = new Date().toISOString().split('T')[0]; // fallback

            if (typeof dateVal === 'number') {
                const jsDate = new Date((dateVal - (25567 + 2)) * 86400 * 1000);
                if (!isNaN(jsDate.getTime())) isoDate = jsDate.toISOString().split('T')[0];
            } else if (typeof dateVal === 'string') {
                isoDate = new Date(dateVal).toISOString().split('T')[0];
            }

            const input: ValuationInput = {
                manufacturer: row[mappings.manufacturer]?.toString().trim() || "Unknown",
                article_number: row[mappings.article_number]?.toString().trim() || "",
                description: row[mappings.description]?.toString().trim() || "",
                category: row[mappings.category]?.toString().trim() || "",
                quantity: parseInt(row[mappings.quantity]) || 1,
                condition: row[mappings.condition]?.toString().trim() || "NOB (Unknown)",
                purchase_date: isoDate
            };

            const targetYear = new Date(input.purchase_date).getFullYear();
            let priceRefBase = lookupPrice(input.article_number, targetYear);
            let priceRefUpdated = priceRefBase ? { ...priceRefBase } : null;

            let usedDatabasePrice = false;
            let hasConflict = false;

            // Override with provided price if available in the Excel
            if (mappings.gross_price !== -1) {
                const providedPriceRaw = row[mappings.gross_price];
                if (providedPriceRaw !== undefined && providedPriceRaw !== null) {
                    const parsedPrice = parseFloat(providedPriceRaw.toString().replace(/\s/g, '').replace(',', '.'));
                    if (!isNaN(parsedPrice) && parsedPrice > 0) {

                        if (!priceRefBase || priceRefBase.is_fallback || priceRefBase.is_interpolated) {
                            // Volledig nieuw of zwak referentiepunt: direct updaten (is_fallback/is_interpolated telt als 'niet echt aanwezig')
                            newLearnedPrices.push({
                                manufacturer: input.manufacturer,
                                article_number: input.article_number,
                                year: targetYear,
                                price: parsedPrice
                            });

                            // In dit geval zijn base en updated hetzelfde (de nieuwe prijs)
                            const updatedRef = {
                                manufacturer: input.manufacturer,
                                article_number: input.article_number,
                                gross_price: parsedPrice,
                                year: targetYear
                            };
                            priceRefBase = updatedRef;
                            priceRefUpdated = updatedRef;
                        } else if (Math.abs(priceRefBase.gross_price - parsedPrice) > 0.001) {
                            // Conflict! 
                            hasConflict = true;
                            priceUpdateCandidates.push({
                                article_number: input.article_number,
                                manufacturer: input.manufacturer,
                                description: input.description,
                                year: targetYear,
                                existing_price: priceRefBase.gross_price,
                                imported_price: parsedPrice,
                            });

                            // priceRefBase blijft de DB prijs
                            // priceRefUpdated krijgt de geïmporteerde prijs
                            priceRefUpdated = {
                                manufacturer: input.manufacturer,
                                article_number: input.article_number,
                                gross_price: parsedPrice,
                                year: targetYear
                            };
                            // Prijs is hetzelfde als in DB
                            usedDatabasePrice = false; // User provided it, so it's not 'from database'
                        }
                    } else {
                        // Ongeldige prijs (NaN of <= 0) -> we moeten de DB prijs gebruiken
                        usedDatabasePrice = true;
                    }
                } else {
                    // Cel is leeg -> DB prijs gebruiken
                    usedDatabasePrice = true;
                }
            } else {
                // Kolom ontbreekt -> DB prijs gebruiken
                usedDatabasePrice = true;
            }

            // Voeg database-meldingen toe
            if (usedDatabasePrice && priceRefBase) {
                priceRefBase.is_from_database = true;
                if (!priceRefBase.price_note) {
                    priceRefBase.price_note = `ℹ️ Prijs uit database (jaar ${priceRefBase.year}): €${priceRefBase.gross_price.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}.`;
                }
                // In sync houden voor de "no internal conflict" cases
                if (!hasConflict) priceRefUpdated = priceRefBase;
            }

            // Bereken base valuation (wat we tonen bij Decline) 
            // In het geval van een conflict is dit DE DB PRIJS, dus is_from_database moet true zijn.
            const valuationBase = calculateValuation(input, priceRefBase, configMatrix);
            if (usedDatabasePrice || hasConflict) {
                valuationBase.is_from_database = true;
            }
            results.push(valuationBase);

            // Bereken updated valuation (wat we tonen bij Accept of als er geen conflict is)
            if (hasConflict) {
                const valuationUpdated = calculateValuation(input, priceRefUpdated, configMatrix);
                // Dit is de IMPORTED prijs, dus is_from_database is false
                valuationUpdated.is_from_database = false;
                resultsWithUpdates.push(valuationUpdated);
            } else {
                // Als er geen conflict is, gebruiken we de base valuation (die is al correct)
                resultsWithUpdates.push(valuationBase);
            }
        }

        // Auto-learn volledig nieuwe prijzen (niet in DB, geen overschrijving)
        if (newLearnedPrices.length > 0) {
            addLearnedPrices(newLearnedPrices);
        }

        // Save to history
        const acceptedItems = results.filter(r => r.status === 'ACCEPTED').length;
        const totalSalesValue = results.reduce((sum, r) => sum + r.sales_value, 0);

        const historyItem: HistoryItem = {
            id: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9),
            date: new Date().toISOString(),
            fileName: file.name,
            createdBy: (formData.get('username') as string) || 'Onbekend',
            totalSalesValue,
            itemsProcessed: results.length,
            acceptedItems,
            results: results
        };
        saveHistory(historyItem);

        return { success: true, data: results, data_with_updates: resultsWithUpdates, price_update_candidates: priceUpdateCandidates };

    } catch (error) {
        console.error("Valuation processing error", error);
        return { success: false, error: error instanceof Error ? error.message : "Unknown error processing file" };
    }
}

/**
 * Slaat goedgekeurde prijsupdates op in de database.
 * Wordt aangeroepen NADAT de gebruiker toestemming heeft gegeven via de modal.
 * Kan ook als lege lijst worden meegegeven (dan doet het niets), zodat de flow
 * altijd door kan zonder opnieuw te beginnen.
 */
export async function finalizePriceUpdates(
    candidates: { article_number: string; manufacturer: string; description: string; year: number; existing_price: number; imported_price: number }[]
): Promise<{ success: boolean; updated: number; error?: string }> {
    try {
        if (!candidates || candidates.length === 0) {
            return { success: true, updated: 0 };
        }

        const updates = candidates.map(c => ({
            manufacturer: c.manufacturer,
            article_number: c.article_number,
            year: c.year,
            price: c.imported_price,
        }));

        addLearnedPrices(updates);
        return { success: true, updated: updates.length };
    } catch (error) {
        console.error('finalizePriceUpdates error', error);
        return { success: false, updated: 0, error: error instanceof Error ? error.message : 'Onbekende fout' };
    }
}

/**
 * Takes the original uploaded Excel file and the valuation results,
 * writes the sales_value (verkoopwaarde) per product into column M ("Waardebepaling"),
 * and returns the enriched workbook as a base64-encoded .xlsx string.
 */
export async function exportEnrichedValuation(formData: FormData): Promise<{
    success: boolean;
    base64?: string;
    fileName?: string;
    error?: string;
}> {
    try {
        const file = formData.get('file') as File;
        const resultsJson = formData.get('results') as string;

        if (!file || !resultsJson) {
            return { success: false, error: "Missing file or valuation results." };
        }

        const results: ValuationOutput[] = JSON.parse(resultsJson);
        const buffer = await file.arrayBuffer();

        // Find the correct sheet and header row using xlsx (fast and reliable)
        const previewWorkbook = xlsx.read(buffer, { type: 'buffer' });
        let targetSheetName: string | null = null;
        let headerRowIdx = -1; // 0-based
        let headers: string[] = [];

        for (const sheetName of previewWorkbook.SheetNames) {
            const sheet = previewWorkbook.Sheets[sheetName];
            const data = xlsx.utils.sheet_to_json<any[]>(sheet, { header: 1 });

            for (let i = 0; i < Math.min(30, data.length); i++) {
                const row = data[i];
                if (row && Array.isArray(row) && row.some(cell => typeof cell === 'string' && cell.toLowerCase().includes('artikel'))) {
                    headerRowIdx = i;
                    targetSheetName = sheetName;
                    headers = row.map((h: any) => (h?.toString() || "").toLowerCase());
                    break;
                }
            }
            if (targetSheetName) break;
        }

        if (!targetSheetName || headerRowIdx === -1) {
            return { success: false, error: "Kon geen geldig tabblad vinden met een 'Artikelnummer' kolom." };
        }

        let base64Str: string = "";

        try {
            // Use xlsx-populate to enrich preserving all visual stuff, images, shapes and styles
            const workbook = await XlsxPopulate.fromDataAsync(buffer);
            const sheet = workbook.sheet(targetSheetName);
            if (!sheet) throw new Error("Tabblad niet gevonden in de sheet builder.");

            const WAARDEBEPALING_COL_IDX = 13; // Column M (1-based index in xlsx-populate)
            const headerCell = sheet.cell(headerRowIdx + 1, WAARDEBEPALING_COL_IDX);

            if (!headerCell.value() || !headerCell.value()?.toString()?.toLowerCase().includes('waardebepaling')) {
                headerCell.value('Waardebepaling');
                headerCell.style("bold", true);
            }

            const articleColIdx = headers.findIndex(h => h.includes('artikel')) + 1; // 1-based index
            const valuationMap = new Map<string, { value: number, error?: string }>();
            for (const result of results) {
                valuationMap.set(result.article_number.trim().toUpperCase(), {
                    value: result.sales_value,
                    error: result.error
                });
            }

            const usedRange = sheet.usedRange();
            if (usedRange) {
                const maxRow = usedRange.endCell().rowNumber();
                for (let r = headerRowIdx + 2; r <= maxRow; r++) {
                    const articleCell = sheet.cell(r, articleColIdx);
                    const articleVal = articleCell.value();
                    if (!articleVal) continue;

                    const articleNumber = articleVal.toString().trim().toUpperCase();
                    const record = valuationMap.get(articleNumber);

                    if (record) {
                        const targetCell = sheet.cell(r, WAARDEBEPALING_COL_IDX);
                        if (record.error) {
                            targetCell.value(`FOUT: ${record.error}`);
                        } else {
                            targetCell.value(record.value);
                            targetCell.style("numberFormat", "0.00"); // Price formatting
                        }
                    }
                }
            }

            const outputBuffer = await workbook.outputAsync();
            base64Str = Buffer.from(outputBuffer as ArrayBuffer).toString('base64');

        } catch (populateError) {
            console.warn("xlsx-populate failed (likely due to legacy .xls format). Falling back to basic xlsx.", populateError);

            // FALLBACK TO STANDARD XLSX
            const sheet = previewWorkbook.Sheets[targetSheetName];
            const data = xlsx.utils.sheet_to_json<any[]>(sheet, { header: 1 });

            const WAARDEBEPALING_COL_IDX = 12; // Column M (0-based)
            const WAARDEBEPALING_HEADER = 'Waardebepaling';

            if (!headers[WAARDEBEPALING_COL_IDX] || !headers[WAARDEBEPALING_COL_IDX].includes('waardebepaling')) {
                const headerCellAddress = xlsx.utils.encode_cell({ r: headerRowIdx, c: WAARDEBEPALING_COL_IDX });
                sheet[headerCellAddress] = { t: 's', v: WAARDEBEPALING_HEADER };
            }

            const articleColIdx = headers.findIndex(h => h.includes('artikel'));
            const valuationMap = new Map<string, { value: number, error?: string }>();
            for (const result of results) {
                valuationMap.set(result.article_number.trim().toUpperCase(), {
                    value: result.sales_value,
                    error: result.error
                });
            }

            for (let i = headerRowIdx + 1; i < data.length; i++) {
                const row = data[i];
                if (!row || !row[articleColIdx]) continue;

                const articleNumber = row[articleColIdx]?.toString().trim().toUpperCase();
                const record = valuationMap.get(articleNumber);

                const cellAddress = xlsx.utils.encode_cell({ r: i, c: WAARDEBEPALING_COL_IDX });
                if (record) {
                    if (record.error) {
                        sheet[cellAddress] = { t: 's', v: `FOUT: ${record.error}` };
                    } else {
                        sheet[cellAddress] = { t: 'n', v: record.value };
                    }
                } else {
                    delete sheet[cellAddress];
                }
            }

            if (sheet['!ref']) {
                const range = xlsx.utils.decode_range(sheet['!ref']);
                if (range.e.c < WAARDEBEPALING_COL_IDX) {
                    range.e.c = WAARDEBEPALING_COL_IDX;
                    sheet['!ref'] = xlsx.utils.encode_range(range);
                }
            }

            base64Str = xlsx.write(previewWorkbook, { type: 'base64', bookType: 'xlsx' });
        }

        const baseName = file.name.replace(/\.(xlsx|xls)$/i, '');
        const outputFileName = `${baseName}_inkoopvoorstel.xlsx`;

        return { success: true, base64: base64Str, fileName: outputFileName };

    } catch (error) {
        console.error("Export enriched valuation error", error);
        return { success: false, error: error instanceof Error ? error.message : "Unknown error during export" };
    }
}
