# ValueTracker

> **Parttracker BV** — Geautomatiseerde waardebepalingstool voor surplus elektronica inventaris

![Version](https://img.shields.io/badge/versie-1.2.7-teal)
![Platform](https://img.shields.io/badge/platform-Windows-blue)
![Built with](https://img.shields.io/badge/built%20with-Next.js%20%2B%20Electron-black)

---

## 📋 Wat doet ValueTracker?

**ValueTracker** is een Windows desktop applicatie waarmee je snel en nauwkeurig een **inkoopwaardebepaling** kunt uitvoeren op surplus industriële elektronica (PLC's, HMI's, frequentieregelaars, etc.). De app berekent automatisch de verkoop- en inkoopwaarde op basis van catalogusprijzen, afschrijvingsregels en de conditie van het materiaal.

---

## ✨ Functies

### 🧮 Waardebepaling
- Upload een **klantexcel** (.xlsx) met een lijst van artikelen
- Zoekt automatisch de **catalogusprijs** op per artikel en jaar
- Berekent de **verkoopwaarde** op basis van:
  - Leeftijd van het artikel (aanschafdatum)
  - Afschrijving jaar 1 en opvolgende jaren (per merk/categorie instelbaar)
  - Conditiestraf (NOB / NIBS)
- Artikelen in conditie **USED**, **REV** of **REP** worden automatisch **afgewezen**
- Resultaten per artikel:
  - Verkoopwaarde
  - Inkoopwaarde Consignatie (75% van verkoop)
  - Inkoopwaarde Extern (80% van verkoop)
  - Status: ACCEPTED / AFWIJZEN

### 📤 Export
- Exporteer resultaten als **CSV** in twee formaten:
  - **Consignatie**: `SKU, Aantal, InkoopConsig, Verkoop`
  - **Extern**: `SKU, Aantal, InkoopExtern, Verkoop`
- Afgewezen artikelen worden automatisch uitgesloten van de export

### 📚 Database Beheer
- Upload **leveranciersprijslijsten** (Excel) via drag & drop
- Controleert automatisch of een prijslijst al eerder is ingelezen
- Prijzen worden **per jaar opgeslagen** als historische tijdlijn per artikel
- Automatische **interpolatie** als het exacte jaar ontbreekt
- **Prijshistorie zoeken**: zoek op artikelnummer en bekijk een interactieve grafiek van de prijsontwikkeling
- Overzichtstabel van alle ingelezen prijslijsten met filters op merk, jaar en bestandsnaam
- **Auto-learning**: nieuw opgezochte prijzen worden automatisch teruggeschreven naar de database

### ⚙️ Configuratie
- Pas per **merk/categorie-combinatie** de afschrijvingsregels aan:
  - Afschrijving jaar 1 (%)
  - Afschrijving opvolgende jaren (%)
  - Conditiestraf NOB (%)
  - Conditiestraf NIBS (%)
- Wijzigingen zijn direct actief

### 📜 Historie
- Elke uitgevoerde waardebepaling wordt automatisch **opgeslagen**
- Bekijk vroegere waardebepalingen en exporteer ze opnieuw

### 🗂️ Data Locatie (OneDrive / Lokaal)
- Instelbaar via **Instellingen** (⚙️ tandwiel rechtsboven):
  - Lokaal (`./data/`) — standaard op je eigen pc
  - OneDrive map — voor gedeeld gebruik met collega's
- De instelling wordt per pc opgeslagen

### 🔄 Automatische updates
- Controleert bij elke start of er een nieuwe versie beschikbaar is op GitHub
- Updates worden stil op de achtergrond gedownload
- Een melding (rechtsonder) verschijnt zodra de update gereed is

---

## 💻 Installatie (Windows)

### Optie A — Installer downloaden ✅ (aanbevolen)

1. Ga naar de [**Releases**](https://github.com/Thijs-sysdev/ValueTracker/releases) pagina
2. Download de nieuwste **`ValueTrackerSetup-x.x.x.exe`**
3. Voer het installatiebestand uit en volg de wizard
4. De app verschijnt als snelkoppeling op het bureaublad en in het Startmenu
5. Dubbelklik om te starten

> **Eerste keer opstarten:** klik op het ⚙️ tandwiel (rechtsboven) → **Instellingen** en stel de data map in als je OneDrive gebruikt.

---

### Optie B — Vanuit broncode (voor ontwikkelaars)

**Vereisten:**
- [Node.js LTS](https://nodejs.org) (v20 of hoger)
- Git

```bash
# 1. Repository clonen
git clone https://github.com/Thijs-sysdev/ValueTracker.git
cd ValueTracker

# 2. Afhankelijkheden installeren
npm install

# 3. App bouwen
npm run build

# 4. App starten (in de browser op http://localhost:3000)
npm start
```

Of dubbelklik op **`Start Waardebepaling.bat`** — dit doet stappen 2-4 automatisch.

---

## 📁 Data map instellen (OneDrive)

Als je de app deelt met collega's via OneDrive:

1. Maak een gedeelde map aan, bijv.:
   ```
   C:\Users\[naam]\OneDrive - Parttracker BV\Apps\ValueTracker\
   ```
2. Kopieer de bestanden uit de lokale `data/` map:
   - `config.json`
   - `history.json`
   - `price_db.json`
   - `price_db_meta.json`
3. Open ValueTracker → klik op ⚙️ → **Instellingen**
4. Vul het volledige pad in → klik **Opslaan** → herstart de app

Alle gebruikers die naar dezelfde OneDrive map wijzen, delen automatisch dezelfde data.

---

## 🔄 Nieuwe versie uitbrengen (voor ontwikkelaars)

1. Maak wijzigingen op de `dev` branch
2. Verhoog het versienummer in `package.json` (bijv. `"version": "1.1.0"`)
3. Merge `dev` → `main`
4. GitHub Actions bouwt automatisch een nieuwe installer en publiceert die als GitHub Release
5. Draaiende apps detecteren de update automatisch

---

## 🏗️ Technische stack

| Onderdeel | Technologie |
|---|---|
| Frontend | Next.js 15 + React 19 |
| Desktop wrapper | Electron |
| Installer | NSIS (via electron-builder) |
| Styling | Tailwind CSS v4 |
| Database | JSON bestanden (lokaal of OneDrive) |
| Auto-updater | electron-updater + GitHub Releases |
| Grafieken | Recharts |
| Excel verwerking | xlsx (SheetJS) |

---

## 📞 Vragen?

Maak een [Issue](https://github.com/Thijs-sysdev/ValueTracker/issues) aan of neem contact op met de ontwikkelaar.
