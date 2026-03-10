import { ValuationInput, PriceReference, ValuationOutput, ValuationConfig } from './types';

function calculateAgeInYears(purchaseDateStr: string, phasedOutYear?: number): number {
    const purchaseDate = new Date(purchaseDateStr);
    let currentDate = new Date();

    if (isNaN(purchaseDate.getTime())) {
        return 0; // Default if invalid date
    }

    if (phasedOutYear) {
        const phasedOutDate = new Date(`${phasedOutYear}-12-31T23:59:59`);
        if (currentDate > phasedOutDate) {
            currentDate = phasedOutDate;
        }
    }

    if (currentDate < purchaseDate) {
        return 0;
    }

    const diffTime = currentDate.getTime() - purchaseDate.getTime();
    const diffYears = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 365.25));
    return Math.min(diffYears, 5); // Max age capped at 5 according to Excel formula logic
}

export function calculateValuation(
    input: ValuationInput,
    priceRef: PriceReference | null,
    configMatrix: Record<string, ValuationConfig>
): ValuationOutput {
    const id = crypto.randomUUID();

    // Rejection logic: USED, REV, REP
    const conditionUpper = input.condition?.toUpperCase() || "";
    if (
        conditionUpper.startsWith("USED") ||
        conditionUpper.startsWith("REV") ||
        conditionUpper.startsWith("REP")
    ) {
        return {
            id,
            article_number: input.article_number,
            sku: input.article_number,
            quantity: input.quantity,
            base_gross_price: priceRef ? priceRef.gross_price : 0,
            base_price_year: priceRef ? priceRef.year : new Date(input.purchase_date).getFullYear(),
            sales_value: 0,
            purchase_value_consignment: 0,
            purchase_value_external: 0,
            status: 'AFWIJZEN',
            error: "Conditie niet geaccepteerd (USED/REV/REP)"
        };
    }

    // Without a price list reference, we can't calculate value
    if (!priceRef) {
        return {
            id,
            article_number: input.article_number,
            sku: input.article_number,
            quantity: input.quantity,
            base_gross_price: 0,
            base_price_year: new Date(input.purchase_date).getFullYear(),
            sales_value: 0,
            purchase_value_consignment: 0,
            purchase_value_external: 0,
            status: 'AFWIJZEN',
            error: "Geen prijsreferentie gevonden in database"
        };
    }

    // Lookup Configuration
    // Excel formula used XLOOKUP with "MerkCategorie" (Manufacturer + Category without spaces)
    const lookupKey = `${input.manufacturer}${input.category}`;
    const config = configMatrix[lookupKey];

    if (!config) {
        return {
            id,
            article_number: input.article_number,
            sku: input.article_number,
            quantity: input.quantity,
            base_gross_price: priceRef.gross_price,
            base_price_year: priceRef.year,
            sales_value: 0,
            purchase_value_consignment: 0,
            purchase_value_external: 0,
            status: 'AFWIJZEN',
            error: `Geen configuratie beschikbaar voor ${input.manufacturer} ${input.category}`
        };
    }

    const startPrice = priceRef.gross_price;
    const age = calculateAgeInYears(input.purchase_date, priceRef.phased_out_year);

    // Depreciation Calculation
    const valueAfterYear1 = startPrice * (1 - config.depreciationYear1);

    let totalValue = valueAfterYear1;
    if (age > 1) {
        const extraYears = Math.ceil(Math.max(0, age - 1));
        totalValue = valueAfterYear1 * Math.pow(1 - config.depreciationSubsequent, extraYears);
    }

    // Condition Penalty
    const conditionPenalty = conditionUpper.startsWith("NOB") ? config.conditionPenaltyNOB : 0;

    // Final values
    const finalSalesValue = totalValue * (1 - conditionPenalty);

    // Purchase Pricing
    const purchaseValueConsignment = Math.round(finalSalesValue * 0.75 * 100) / 100; // 3/4
    const purchaseValueExternal = Math.round(finalSalesValue * 0.80 * 100) / 100; // 4/5
    const roundedSalesValue = Math.round(finalSalesValue * 100) / 100;

    // Extract condition prefix for SKU (text before first parenthesis, or entire text)
    let conditionPrefix = conditionUpper;
    const parenIndex = conditionUpper.indexOf("(");
    if (parenIndex > -1) {
        conditionPrefix = conditionUpper.substring(0, parenIndex).trim();
    } else if (conditionPrefix.length > 5) {
        conditionPrefix = conditionPrefix.substring(0, 4); // safely truncate if no parenthesis
    }

    const sku = `${input.article_number}-${conditionPrefix}`;

    let priceNote = priceRef.price_note;
    if (priceRef.phased_out_year) {
        const phaseOutNote = `⚠️ Artikel is uitgefaseerd in ${priceRef.phased_out_year}. Afschrijving stopt in dit jaar.`;
        priceNote = priceNote ? `${priceNote}\n${phaseOutNote}` : phaseOutNote;
    }

    return {
        id,
        article_number: input.article_number,
        sku,
        quantity: input.quantity,
        base_gross_price: startPrice,
        base_price_year: priceRef.year,
        sales_value: roundedSalesValue,
        purchase_value_consignment: purchaseValueConsignment,
        purchase_value_external: purchaseValueExternal,
        status: 'ACCEPTED',
        price_note: priceNote,
        is_phased_out: !!priceRef.phased_out_year
    };
}
