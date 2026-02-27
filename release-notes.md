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
