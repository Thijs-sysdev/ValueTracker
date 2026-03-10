'use server';

import * as xlsx from 'xlsx';
import { ValuationInput, ValuationOutput, HistoryItem, PriceUpdateCandidate } from '@/lib/types';
import { calculateValuation } from '@/lib/valuation';
import { lookupPrice, addLearnedPrices } from '@/lib/priceList';
import { saveHistory } from '@/lib/history';
import { getConfigMatrix } from '@/lib/config';

export async function processValuationFile(formData: FormData): Promise<{
    success: boolean;
    data?: ValuationOutput[];
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
        const priceUpdateCandidates: PriceUpdateCandidate[] = [];
        // newLearnedPrices bevat items waarover de gebruiker GEEN toestemming hoeft te geven
        // (volledig nieuwe artikelen die nog niet in de DB staan).
        // Overschrijf-kandidaten gaan via priceUpdateCandidates met consent-flow.
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
            let priceRef = lookupPrice(input.article_number, targetYear);
            let usedDatabasePrice = false;

            // Override with provided price if available in the Excel
            if (mappings.gross_price !== -1) {
                const providedPriceRaw = row[mappings.gross_price];
                if (providedPriceRaw !== undefined && providedPriceRaw !== null) {
                    const parsedPrice = parseFloat(providedPriceRaw.toString().replace(/\s/g, '').replace(',', '.'));
                    if (!isNaN(parsedPrice) && parsedPrice > 0) {

                        if (!priceRef) {
                            // Volledig nieuw artikel: zet het in de DB (user consent niet nodig)
                            newLearnedPrices.push({
                                manufacturer: input.manufacturer,
                                article_number: input.article_number,
                                year: targetYear,
                                price: parsedPrice
                            });
                        } else if (priceRef.is_fallback || priceRef.is_interpolated) {
                            // DB had alleen een geschatte/geïnterpoleerde prijs → beschouwen als 'nieuw leren'
                            newLearnedPrices.push({
                                manufacturer: input.manufacturer,
                                article_number: input.article_number,
                                year: targetYear,
                                price: parsedPrice
                            });
                        } else if (Math.abs(priceRef.gross_price - parsedPrice) > 0.001) {
                            // Importprijs wijkt af van bestaande DB prijs → toestemming vragen
                            priceUpdateCandidates.push({
                                article_number: input.article_number,
                                manufacturer: input.manufacturer,
                                description: input.description,
                                year: targetYear,
                                existing_price: priceRef.gross_price,
                                imported_price: parsedPrice,
                            });
                        }
                        // Overschrijf altijd de referentie voor de berekening met de importprijs
                        priceRef = {
                            manufacturer: input.manufacturer,
                            article_number: input.article_number,
                            gross_price: parsedPrice,
                            year: targetYear
                        };
                    } else {
                        // Geen geldige prijs in het importbestand → DB prijs gebruiken
                        usedDatabasePrice = true;
                    }
                } else {
                    // Kolom bestaat maar is leeg → DB prijs gebruiken
                    usedDatabasePrice = true;
                }
            } else {
                // Kolom bestaat niet in het bestand → DB prijs gebruiken
                usedDatabasePrice = true;
            }

            // Voeg database-melding toe als de prijs uit de DB komt
            if (usedDatabasePrice && priceRef) {
                priceRef.is_from_database = true;

                // Voeg alleen een generieke melding toe als er nog geen specifieke melding (zoals interpolatie of fallback) is
                if (!priceRef.price_note) {
                    priceRef.price_note = `ℹ️ Prijs uit database (jaar ${priceRef.year}): €${priceRef.gross_price.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}.`;
                }
            }

            const valuation = calculateValuation(input, priceRef, configMatrix);
            // Zet de is_from_database vlag ook op het output-object zodat de UI het kan tonen
            if (usedDatabasePrice && priceRef) {
                valuation.is_from_database = true;
            }
            results.push(valuation);
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

        return { success: true, data: results, price_update_candidates: priceUpdateCandidates };

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
        const workbook = xlsx.read(buffer, { type: 'buffer' });

        // Find the correct sheet and header row (same logic as processValuationFile)
        let targetSheetName: string | null = null;
        let headerRowIdx = -1;

        for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            const data = xlsx.utils.sheet_to_json<any[]>(sheet, { header: 1 });

            for (let i = 0; i < Math.min(30, data.length); i++) {
                const row = data[i];
                if (row && Array.isArray(row) && row.some(cell => typeof cell === 'string' && cell.toLowerCase().includes('artikel'))) {
                    headerRowIdx = i;
                    targetSheetName = sheetName;
                    break;
                }
            }
            if (targetSheetName) break;
        }

        if (!targetSheetName || headerRowIdx === -1) {
            return { success: false, error: "Kon geen geldig tabblad vinden met een 'Artikelnummer' kolom." };
        }

        const sheet = workbook.Sheets[targetSheetName];
        const data = xlsx.utils.sheet_to_json<any[]>(sheet, { header: 1 });
        const headers: string[] = data[headerRowIdx].map((h: any) => (h?.toString() || "").toLowerCase());

        // Column M is index 12 (0-based). Write the header if not already present.
        const WAARDEBEPALING_COL_IDX = 12; // Column M
        const WAARDEBEPALING_HEADER = 'Waardebepaling';

        // If header row doesn't already have the column, add it
        if (!headers[WAARDEBEPALING_COL_IDX] || !headers[WAARDEBEPALING_COL_IDX].includes('waardebepaling')) {
            const headerCellAddress = xlsx.utils.encode_cell({ r: headerRowIdx, c: WAARDEBEPALING_COL_IDX });
            sheet[headerCellAddress] = { t: 's', v: WAARDEBEPALING_HEADER };
        }

        // Build a lookup map from article_number -> sales_value from results
        const articleColIdx = headers.findIndex(h => h.includes('artikel'));
        const valuationMap = new Map<string, number>();
        for (const result of results) {
            if (result.status === 'ACCEPTED') {
                valuationMap.set(result.article_number.trim().toUpperCase(), result.sales_value);
            }
        }

        // Walk every data row and write value into column M
        for (let i = headerRowIdx + 1; i < data.length; i++) {
            const row = data[i];
            if (!row || !row[articleColIdx]) continue;

            const articleNumber = row[articleColIdx]?.toString().trim().toUpperCase();
            const salesValue = valuationMap.get(articleNumber);

            const cellAddress = xlsx.utils.encode_cell({ r: i, c: WAARDEBEPALING_COL_IDX });
            if (salesValue !== undefined) {
                sheet[cellAddress] = { t: 'n', v: salesValue };
            } else {
                // Clear cell if present (item is rejected or not found)
                delete sheet[cellAddress];
            }
        }

        // Update sheet range to include column M
        if (sheet['!ref']) {
            const range = xlsx.utils.decode_range(sheet['!ref']);
            if (range.e.c < WAARDEBEPALING_COL_IDX) {
                range.e.c = WAARDEBEPALING_COL_IDX;
                sheet['!ref'] = xlsx.utils.encode_range(range);
            }
        }

        // Serialize workbook to base64
        const outputBuffer = xlsx.write(workbook, { type: 'base64', bookType: 'xlsx' });

        const baseName = file.name.replace(/\.(xlsx|xls)$/i, '');
        const outputFileName = `${baseName}_inkoopvoorstel.xlsx`;

        return { success: true, base64: outputBuffer, fileName: outputFileName };

    } catch (error) {
        console.error("Export enriched valuation error", error);
        return { success: false, error: error instanceof Error ? error.message : "Unknown error during export" };
    }
}
