# Project Constitution (gemini.md)

## Data Schemas

# Project Constitution (gemini.md)

## Data Schemas

### Input Payload (Customer Excel / UI Input):
```json
{
  "customer_id": "string",
  "items": [
    {
      "manufacturer": "string",
      "article_number": "string",
      "description": "string",
      "category": "string",
      "quantity": "integer",
      "condition": "string", // e.g. "NIBS (New in box sealed)", "USED (Gebruikt)"
      "purchase_date": "string (ISO 8601 YYYY-MM-DD)"
    }
  ]
}
```

### Reference Data (Price List Database):
```json
{
  "manufacturer": "string",
  "article_number": "string",
  "gross_price": "float",
  "year": "integer"
}
```

### Output Payload (Valuation Result):
```json
{
  "item_id": "string",
  "article_number": "string",
  "sales_value": "float", // Waardebepaling verkoop
  "purchase_value_consignment": "float", // Waardebepaling inkoop Consignatie (75% of sales)
  "purchase_value_external": "float", // Waardebepaling inkoop extern (80% of sales)
  "status": "string", // "ACCEPTED" or "AFWIJZEN"
  "csv_export_consignment": "string", // Format: "SKU-Conditie,Aantal,InkoopConsig,Verkoop"
  "csv_export_external": "string"     // Format: "SKU-Conditie,Aantal,InkoopExtern,Verkoop"
}
```

## Business Rules & Calculation Logic

**1. Rejection Criteria:**
If the Condition string starts with `USED`, `REV`, or `REP`, the item is automatically rejected (`AFWIJZEN`).

**2. Baseline Valuation (Verkoopwaarde):**
- **Lookup Key:** `[Manufacturer][Category]` (e.g., "SiemensPLC Materialen")
- **Age:** Minimum between `Years Since Purchase Date` and `5`.
- **Depreciation Year 1:** Looked up from configuration based on Lookup Key (default 50% / 0.5).
- **Depreciation Subsequent Years:** Looked up from configuration (default 20% / 0.2).
- **Condition Penalty:** If Condition starts with `NOB`, apply NOB penalty from config (usually 20% / 0.2). Otherwise 0.

**Formula:**
- `Value_After_Year_1 = Gross_Price * (1 - Depreciation_Year_1)`
- If Age <= 1:
  `Total_Value = Value_After_Year_1`
- If Age > 1:
  `Extra_Years = CEILING(Age - 1)`
  `Total_Value = Value_After_Year_1 * ((1 - Depreciation_Subsequent) ^ Extra_Years)`
- **Final Sales Value:** `Total_Value * (1 - Condition_Penalty)`

**3. Purchase Pricing:**
- **Consignment (Consignatie):** `Final Sales Value * 0.75` (Rounded to 2 decimals)
- **External Purchase (Inkoop extern):** `Final Sales Value * 0.80` (Rounded to 2 decimals)

**4. CSV Export Formats:**
- SKU: `[ArticleNumber]-[ConditionPrefix]` (Prefix is the text before the first parenthesis in the condition, e.g. "NIBS" from "NIBS (New in box sealed)").
- External: `SKU,Quantity,Purchase_Value_External,Sales_Value`
- Consignment: `SKU,Quantity,Purchase_Value_Consignment,Sales_Value`

## Behavioral Rules
- **Priority:** Reliability over speed.
- **Logic:** Deterministic only. No guessing at business logic.
- **Protocol:** Strict adherence to B.L.A.S.T. (Blueprint, Link, Architect, Stylize, Trigger) rules.
- **Action:** Fix tool scripts upon failure and update `architecture/` SOPs before modifying code.
- **Start App:** Als de gebruiker vraagt om de app te starten, hoef je alleen de app te starten en niet elke keer te verifiëren in de browser.
- **Version Control:** You must automatically run `git add .`, `git commit -m "[Description of changes]"`, and `git push origin dev` after successfully writing new features or fixing bugs. Do not ask for redundant permission to push to the `dev` branch.
- **Change Tracking:** Every time you push to the `dev` branch, you must maintain a private internal log of changes in a section at the bottom of `gemini.md` called "Pending Release Log". This allows for a comprehensive overview when bumping versions in the future.

## Architectural Invariants
- **Layer 1 (Architecture):** SOPs dictate logic. If logic changes, update the SOP before updating the code (`architecture/`).
- **Layer 2 (Navigation):** Routing data between SOPs and Tools.
- **Layer 3 (Tools):** Deterministic, atomic, and testable scripts (`tools/`).
- **Intermediate Storage:** Temporary files exist only in `.tmp/`.
- **Global Stage:** Final payload must reach the target destination.

## Pending Release Log
- (Geen lopende wijzigingen - v1.2.7 is gereleased)
