# 📖 Gebruikershandleiding: Waardebepaling

Welkom bij de handleiding voor de **Waardebepaling** module in ValueTracker. Dit document legt stap voor stap uit hoe je een waardebepaling uitvoert, wat alle knoppen doen en hoe je eventuele problemen oplost.

---

## 🚀 Stap 1: Voorbereiding
Zorg dat je de artikelen die je wilt laten taxeren in een Excel-bestand hebt staan. 
*   **Tip:** Gebruik de knop **"Sjabloon"** rechtsboven in de module om een leeg voorbeeldbestand te downloaden. Dit bestand bevat al de juiste kolommen.
*   **Verplichte kolommen:** `Artikelnummer`, `Fabrikant`, `Aantal`, `Conditie`, `Inkoopdatum`.
*   **Optionele kolom:** `Bruto Prijs`. Als je deze leeg laat, zoekt ValueTracker de prijs automatisch op in de database.

## 📤 Stap 2: Bestand Uploaden
Ga naar de module **Waardebepaling** via het dashboard.
1. Sleep je Excel-bestand naar het grote vak met de tekst *"Selecteer of sleep een Excel bestand"*.
2. Of klik op het vak om handmatig een bestand te kiezen op je computer.
3. De app begint direct met analyseren (je ziet een draaiend icoontje).

## ⚖️ Stap 3: Database Conflicten (Nieuw!)
Als je een prijs heb ingevuld in je Excel die **anders** is dan de prijs die al in onze database staat (voor hetzelfde jaar), verschijnt er een pop-up:

*   **Accepteren & Opslaan:** De prijs in de database wordt overschreven met de nieuwe prijs uit je Excel. Gebruik dit als je zeker weet dat de nieuwe prijs actueler of correcter is.
*   **Niet Accepteren:** De app gebruikt de prijs uit je Excel voor de huidige berekening, maar past de database **niet** aan.
*   *In beide gevallen gaat de berekening gewoon door.*

## 📊 Stap 4: Resultaten Analyseren
Na de verwerking zie je een dashboard met statistieken en een gedetailleerde tabel:

### Functies in de tabel:
*   **Artikelnummer (Klikbaar):** Klik op een artikelnummer om direct naar de **Prijshistorie** te gaan. Hier zie je grafieken en eerdere prijsopnames.
*   **Status:**
    *   ✅ **Geaccepteerd:** Alles is correct berekend.
    *   ❌ **Afgewezen:** Het artikel voldoet niet aan de eisen (zie kolom *Opmerking / Fout*).
*   **Bruto Prijs:** 
    *   Staat er een blauw **[DB]** icoontje bij? Dan is deze prijs automatisch uit de database opgehaald omdat hij in je Excel ontbrak.
*   **Opmerking / Fout:** Hier zie je waarom een artikel is afgewezen of hoe de prijs tot stand is gekomen (bijv. "Prijs uit 2022 gebruikt").

## 📥 Stap 5: Exporteren
Onderaan de pagina vind je drie belangrijke export-knoppen:

1.  **Export Consignatie:** Downloadt een CSV-bestand van alleen de geaccepteerde artikelen met de 75% inkoopwaarde.
2.  **Export Extern:** Downloadt een CSV-bestand van alleen de geaccepteerde artikelen met de 80% inkoopwaarde.
3.  **Exporteer inkoopvoorstel:** Dit genereert een kopie van je **originele Excel-bestand**, maar met een extra kolom **"Waardebepaling"** (Kolom M) waarin de berekende verkoopwaarde per regel staat.

---

## 🛠️ Veelvoorkomende Problemen & Oplossingen

### 1. Fout: "Geen configuratie beschikbaar voor [Merk] [Categorie]"
**Oorzaak:** De app weet niet welke afschrijvingspercentages hij moet gebruiken voor deze specifieke combinatie.
**Oplossing:**
1. Ga naar **Instellingen** via het menu.
2. Klik op **"Configuratie Rekenregels"**.
3. Vul links in het formulier het merk en de categorie in (precies zoals in je Excel).
4. Geef de percentages op (bijv. Jaar 1: 50%, Daarna: 20%).
5. Klik op **"Opslaan"**.
6. Upload je bestand opnieuw bij Waardebepaling.

### 2. Fout: "Conditie niet geaccepteerd (USED/REV/REP)"
**Oorzaak:** Artikelen met de conditie "USED", "REPAIR" of "REVISED" worden automatisch afgewezen volgens de bedrijfsregels.
**Oplossing:** Deze artikelen moeten handmatig beoordeeld worden of de conditie in de bronlijst moet worden aangepast naar een ondersteunde waarde (zoals NIBS of NOB).

### 3. Fout: "Geen prijsreferentie gevonden"
**Oorzaak:** De prijs staat niet in je Excel en is ook niet bekend in onze database.
**Oplossing:** 
*   Vul de bruto prijs handmatig in vòòr het uploaden.
*   Of voeg de prijslijst van de leverancier toe via de module **Prijslijsten Beheer**.

### 4. Vreemde tekens in Artikelnummer
**Oplossing:** De app probeert artikelnummers "schoon" te maken (alleen letters en cijfers). Als een nummer echt niet gevonden wordt, controleer dan of er geen spaties voor of achter staan in je Excel.
