'use server';

import * as xlsx from 'xlsx';
import { ValuationInput, ValuationOutput, HistoryItem } from '@/lib/types';
import { calculateValuation } from '@/lib/valuation';
import { lookupPrice, addLearnedPrices } from '@/lib/priceList';
import { saveHistory } from '@/lib/history';
import { getConfigMatrix } from '@/lib/config';

export async function processValuationFile(formData: FormData): Promise<{
    success: boolean;
    data?: ValuationOutput[];
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

            // Override with provided price if available in the Excel
            if (mappings.gross_price !== -1) {
                const providedPriceRaw = row[mappings.gross_price];
                if (providedPriceRaw !== undefined && providedPriceRaw !== null) {
                    const parsedPrice = parseFloat(providedPriceRaw.toString().replace(/\s/g, '').replace(',', '.'));
                    if (!isNaN(parsedPrice) && parsedPrice > 0) {

                        // If price is unknown or guessed, we learn it!
                        if (!priceRef || priceRef.is_fallback || priceRef.is_interpolated) {
                            newLearnedPrices.push({
                                manufacturer: input.manufacturer,
                                article_number: input.article_number,
                                year: targetYear,
                                price: parsedPrice
                            });
                        }

                        priceRef = {
                            manufacturer: input.manufacturer,
                            article_number: input.article_number,
                            gross_price: parsedPrice,
                            year: targetYear
                        };
                    }
                }
            }

            const valuation = calculateValuation(input, priceRef, configMatrix);
            results.push(valuation);
        }

        // Auto-learn new prices
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
            totalSalesValue,
            itemsProcessed: results.length,
            acceptedItems,
            results: results
        };
        saveHistory(historyItem);

        return { success: true, data: results };

    } catch (error) {
        console.error("Valuation processing error", error);
        return { success: false, error: error instanceof Error ? error.message : "Unknown error processing file" };
    }
}
