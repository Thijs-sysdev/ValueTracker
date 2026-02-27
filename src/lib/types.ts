export interface ValuationInput {
    manufacturer: string;
    article_number: string;
    description: string;
    category: string;
    quantity: number;
    condition: string;
    purchase_date: string; // ISO format YYYY-MM-DD
}

export interface HistoricalPrice {
    year: number;
    price: number;
}

export interface DBPriceRecord {
    manufacturer: string;
    article_number: string;
    history: HistoricalPrice[];
    phased_out_year?: number;
}

export interface PriceReference {
    manufacturer: string;
    article_number: string;
    gross_price: number;
    year: number;
    is_interpolated?: boolean;
    is_fallback?: boolean;
    price_note?: string;
    phased_out_year?: number;
}

export interface ValuationOutput {
    id: string;
    article_number: string;
    sku: string; // article_number + '-' + condition prefix
    quantity: number;
    base_gross_price: number; // Nieuwprijs
    base_price_year: number; // Jaar van de nieuwprijs
    sales_value: number; // Verkoopwaarde
    purchase_value_consignment: number; // Inkoop Consignatie
    purchase_value_external: number; // Inkoop extern
    status: 'ACCEPTED' | 'AFWIJZEN';
    price_note?: string;
    error?: string;
    is_phased_out?: boolean;
}

export interface ValuationConfig {
    key: string;
    manufacturer?: string;
    category?: string;
    depreciationYear1: number;
    depreciationSubsequent: number;
    conditionPenaltyNOB: number;
    conditionPenaltyNIBS: number;
}

export interface HistoryItem {
    id: string;
    date: string;
    fileName: string;
    createdBy?: string;
    totalSalesValue: number;
    itemsProcessed: number;
    acceptedItems: number;
    results: ValuationOutput[];
}
