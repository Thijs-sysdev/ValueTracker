# Findings & Constraints

## Discovery Answers

1. **North Star:** Transform the manual, Excel-based valuation of surplus inventory for 'Parttracker' into an automated web application. The goal is to easily calculate the value of customer-offered surplus stock based on old gross price lists, generate sales/purchase proposals, and eventually allow customers to perform these valuations themselves via the app.
2. **Integrations:** 
   - Excel parser (to read customer-provided inventory lists).
   - Price list database/lookup (to access historical gross factory prices).
   - *Pending:* Potential email or CRM integration for sending proposals.
3. **Source of Truth:** 
   - Input: Excel forms provided by customers containing their surplus products.
   - Reference: Historical price lists containing "bruto (fabrieks) prijzen" (gross factory prices).
4. **Delivery Payload:** 
   - A Web UI displaying the calculated valuation.
   - Output: A sales proposal (verkoopvoorstel) or purchase offer (inkoopvoorstel) based on the calculated value.
5. **Behavioral Rules:** 
   - Calculations must be completely deterministic based on the (soon to be provided) business rules.
   - UI should be accessible for internal staff first, and designed with a future customer-facing portal in mind.
   - *Pending:* Specific security or access control constraints.

## Constraints
- The exact calculation logic is pending user input.
- Need to determine the structure of the customer Excel files and the historical price lists.
