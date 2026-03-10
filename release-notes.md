# ValueTracker V1.2.6 - Dashboard & Export Verbeteringen
**Releasedatum:** 10 maart 2026

## Nieuwe Functies & Verbeteringen

### 📤 Inkoopvoorstel Verrijking (Einde aan exporteren-stop)
Het is nu mogelijk om het inkoopvoorstel (Excel-verrijking) te exporteren, zelfs als er artikelen zijn geweigerd (bijv. USED/REV/REP). 
- **Foutopname**: Geweigerde artikelen worden nu gewoon meegenomen in de Excel.
- **Nederlandse Foutmeldingen**: De reden van afwijzing wordt in helder Nederlands in de "Waardebepaling" kolom gezet (bijv. "Conditie niet geaccepteerd" i.p.v. "Condition rejected").

### 📊 Verbeterde Waardebepaling Tabel
De tabel in de waardebepaling-module heeft een flinke upgrade gekregen:
- **Maximale Ruimte**: De tabel gebruikt nu 98% van de schermbreedte.
- **Geen Limieten**: De limiet van 50 rijen is verwijderd. Alle ingeladen artikelen zijn direct zichtbaar.
- **Custom Scrolling**: De horizontale scrollbalk is nu gestyled volgens onze moderne "deep dark" aesthetic.

## Opgeloste problemen

### 🐛 Prijslogica & UX
- **Deduplicatie**: Opgelost dat er dubbele (tegenstrijdige) prijsnotities verschenen bij historische prijzen.
- **Calculatie Fix**: Opgelost dat bij het weigeren van een prijsupdate (overschrijf-consent) de app niet correct terugviel op de oude databaseprijs.
- **DB-Badge**: De "DB" badge verschijnt niet meer onterecht wanneer een geïmporteerde prijs exact overeenkomt met de database.

### 🐛 UI & Export (Waardebepaling)
- **Inkoopvoorstel Export**: De styling van het originele importbestand (kleuren, randen, afbeeldingen en tekstvakken) ging voorheen verloren bij het exporteren van het inkoopvoorstel. Dit wordt nu perfect behouden.
- **Consent Modal**: De knoppen onderaan de "Prijzen overschrijven" popup vielen horizontaal buiten beeld op kleinere schermen. Dit is opgelost met een responsive lay-out.

---

**Releasedatum:** 5 maart 2026

## Opgeloste problemen

### 🐛 Installer: AI Pop-up Blokkade
De automatische updater kon in sommige gevallen blijven hangen op de vraag voor het downloaden van het AI-model, waardoor de update niet geruisloos kon worden voltooid.
- **Oplossing:** De installer controleert nu expliciet of hij in "Silent Mode" draait. Indien stil geïnstalleerd (auto-update), wordt de pop-up overgeslagen en wordt de standaardkeuze (Nee) gekozen om blokkades te voorkomen.

### 🔍 AI Search Bar Verbeteringen
- **Bekijk in Database:** Opgelost dat de knop "Bekijk in database" soms het verkeerde artikelnummer extraheerde uit de AI-context.
- **Concise Responses:** De AI geeft nu kortere, krachtigere antwoorden bij simpele statusvragen over één artikel, zonder onnodige trendhistorie tenzij expliciet gevraagd.

### 🔄 Re-analyse Stabiliteit
- **Progress Fix:** Opgelost dat het voortgangspercentage van de re-analyse soms niet live update door het vrijgeven van de event-loop tijdens zware berekeningen.

---

# ValueTracker V1.2.4 - Grote AI & Functionaliteit Update

**Releasedatum:** 3 maart 2026

## Nieuwe Functies & Verbeteringen

### 🤖 Geavanceerd RAG Systeem
De AI-assistent is nu nog krachtiger dankzij een hybride RAG-pipeline (Retrieval-Augmented Generation). 
- **Lokale Vector Store:** De AI kan nu razendsnel relevante informatie vinden in je lokale database.
- **OneDrive Documenten:** De AI heeft nu direct toegang tot handleidingen en prijslijsten die op OneDrive staan voor een bredere context.

### 🔍 Detective AI & Visuele Grafieken
De AI-assistent in de overlay is uitgebreid met analytische vaardigheden:
- **Detective Mode:** De AI herkent nu automatisch de intentie van je vraag (bijv. prijsverloop over jaren) en presenteert de data in overzichtelijke Markdown-tabellen.
- **Visual Analytics:** Er is een nieuwe visuele prijsgrafiek toegevoegd aan de AI-overlay, zodat je trends direct in één oogopslag kunt zien.

### 🔗 Product Lifecycle Tracking
Nieuwe logica voor artikelnummers:
- **Successor/Predecessor Linking:** Artikelen worden nu gekoppeld aan hun opvolgers of voorgangers. 
- **Slimme Depreciatie:** Voor phased-out artikelen wordt de afschrijving nu automatisch bevroren vanaf het jaar van uitfasering.

### 🔄 Bulk Re-analyse
Nieuwe knop op de Instellingenpagina om alle ingelezen prijslijsten in één keer opnieuw te scannen met de nieuwste parsing-logica, zonder handmatige re-uploads.

### 🎨 Styling & UX Upgrade
De instellingenpagina heeft een volledige visuele revisie gekregen:
- **Deep Dark SaaS Aesthetic:** Voor een professionele en moderne uitstraling.
- **Verbeterde Inputs:** Duidelijkere invoervelden met betere leesbaarheid en volledige breedte layout.
- **Interactieve Knoppen:** Nieuwe knopstyling met duidelijke hover-effecten en loading indicators.

## Opgeloste problemen

### 🐛 Startup & Stabiliteit
- **Onnxruntime Fix:** Opgelost dat de app soms niet startte door fouten in de gebundelde AI-runtime.
- **Robuustere Analyse:** De re-analyse slaat nu automatisch corrupte of met een wachtwoord beveiligde bestanden over in plaats van vast te lopen.

---

# ValueTracker V1.2.3 - Bugfix: Auto-updater (definitieve installer-fix)

**Releasedatum:** 27 februari 2026

## Opgeloste problemen

### 🐛 "ValueTracker kan niet automatisch worden afgesloten" — definitieve fix
De installatie bleef blokkeren met twee foutmeldingen, ook na v1.2.1 en v1.2.2.

**Oorzaak (definitief):** Na analyse van de electron-builder NSIS-broncode bleek dat electron-builder een eigen `_CHECK_APP_RUNNING` macro heeft die in de install Section draait. Deze macro probeert ValueTracker zelf te sluiten via PowerShell of tasklist, en toont bij mislukking de "appCannotBeClosed" dialog. Onze eerdere fixes (`customInit`) draaiden wél vóór deze check, maar electron-builder voerde daarna alsnog zijn eigen detectie uit.

**Oplossing:** Gebruik van de officiële electron-builder escape-hatch: door `customCheckAppRunning` te definiëren wordt de **hele** `_CHECK_APP_RUNNING` logica van electron-builder vervangen door onze eigen implementatie. Deze macro voert een directe `taskkill /F` uit via het volledige systeempad (`$SYSDIR\taskkill.exe`) en wacht 2 seconden — zonder enige dialoogvenster te tonen. Daarna gaat de installatie altijd gewoon door. Er is tevens een vroegere kill in `.onInit` behouden als extra zekerheid.

---

# ValueTracker V1.2.2 - Bugfix: Auto-updater (installer-level fix)

**Releasedatum:** 27 februari 2026

## Opgeloste problemen

### 🐛 Auto-updater: "Sluit ValueTracker af" op andere pc's
Op pc's met versie 1.2.0/1.2.1 installé bleef de NSIS-installer melden dat ValueTracker afgesloten moest worden, ondanks dat de app al gestopt was.

**Oorzaak:** De fix in v1.2.1 (extra sluitlogica in `main.js`) helpt alleen voor _toekomstige_ updates — bij het updaten _vanaf_ v1.2.0 of v1.2.1 draait de oude `main.js` nog. Die heeft de fix niet. NSIS controleert het actieve process nog vóórdat onze eigen `customInstall` macro draait.

**Oplossing:** De fix is verplaatst naar de NSIS installer zelf via een `customInit` macro. Deze draait als allereerste stap van de installer (in `.onInit`), vóór de process-check. De macro voert `taskkill /F /IM ValueTracker.exe /T` uit en wacht 1 seconde, zodat het process volledig gestopt is voordat de installatie verdergaat. Deze fix werkt onafhankelijk van welke versie van `main.js` geïnstalleerd is.

---

# ValueTracker V1.2.1 - Bugfix: Auto-updater

**Releasedatum:** 27 februari 2026

## Opgeloste problemen

### 🐛 Auto-updater: "Sluit ValueTracker af" foutmelding
Bij het klikken op **"Nu herstarten & installeren"** meldde de NSIS-installer ten onrechte dat ValueTracker nog actief was, waardoor de installatie halverwege blokkeerde — terwijl de app al via de UI was afgesloten.

**Oorzaak:** `quitAndInstall()` lanceerde de installer terwijl het Electron-proces nog bezig was met afsluiten. Windows had de process-handle nog niet vrijgegeven op het moment dat NSIS zijn actieve-processen-controle uitvoerde.

**Oplossing:** Alle vensters worden nu expliciet gesloten vóór `quitAndInstall()` wordt aangeroepen, met een korte wachttijd (500 ms) zodat het OS het process volledig kan beëindigen voordat de installer start.

---

# ValueTracker V1.2.0 - AI & Performance Update

Gefeliciteerd! ValueTracker is geüpgraded naar **V1.2.0**. Deze versie brengt significante verbeteringen aan de AI-assistent, hardware-optimalisaties en UI-verfijningen.

## Belangrijkste Nieuwe Functies & Verbeteringen

### 1. AI Hardware-optimalisatie (GPU)
De AI-assistent maakt nu volledig gebruik van je **NVIDIA RTX 4070 Ti**. Door `gpuLayers: 'max'` in te schakelen, wordt de rekenkracht van je grafische kaart benut, wat resulteert in bliksemsnelle antwoorden.

### 2. Geavanceerde RAG (Search Fallback)
De AI is nu "slimmer" in het vinden van data. Als een specifiek artikelnummer niet direct wordt gevonden, voert de app een brede zoekactie uit op basis van keywords. Hierdoor kan de AI contextuele vragen over productlijnen en trends beter beantwoorden.

### 3. Verbeterde Logica & Trendanalyse
We hebben "Chain of Thought" (denkstappen) afgedwongen voor de AI. De AI typt nu expliciet zijn denkproces uit:
- Prijs oudste jaar?
- Prijs nieuwste jaar?
- Conclusie (stijging/daling).
Dit elimineert hallucinaties waarbij de AI prijzen verkeerd om interpreteerde.

### 4. Graceful Data Degradation
Wanneer je een gemiddelde vraagt over een periode waarvoor de data niet compleet is, stopt de AI niet meer. Hij berekent het gemiddelde over de beschikbare jaren en vermeldt expliciet welke jaren hij heeft gebruikt.

---
*Gereed voor gebruik op de dev branch en gemerged naar main.*
