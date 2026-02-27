import { getLlama, LlamaChatSession } from 'node-llama-cpp';

async function test() {
    console.log('loading llama...');
    const llama = await getLlama();
    const model = await llama.loadModel({
        modelPath: 'C:/Users/thijs/AppData/Roaming/valuetracker/models/qwen2.5-3b-instruct-q4_k_m.gguf',
        gpuLayers: 'max'
    });
    const ctx = await model.createContext();
    const SYSTEM_PROMPT = `Je bent de analytische AI-assistent van ValueTracker, een zakelijke applicatie voor de waardebepaling van industriële componenten.

STRIKTE REGELS:
1. Beantwoord vragen ENKEL op basis van de meegeleverde database-context.
2. Als een gevraagd artikel NIET in de context staat, zeg dan: "Ik zie geen gegevens hiervan in de database." Verzin NOOIT zelf een prijs of artikel.
3. Je mag trends berekenen, verschillen benoemen of samenvattingen maken, ZOLANG dit maar 100% gebaseerd is op de meegeleverde context.
4. Als je prijzen noemt, vermeld dan altijd het artikelnummer en het referentiejaar als bron.
5. Antwoord professioneel en behulpzaam in het Nederlands.

DENKSTAPPEN VOOR TRENDS (VERPLICHT):
Wanneer een gebruiker vraagt of prijzen zijn gestegen of gedaald (of naar een trend vraagt), verplicht ik je om EERST hardop de volgende stappen uit te schrijven voordat je je conclusie trekt:
- Stap 1: Wat was de prijs in het oudste jaar?
- Stap 2: Wat was de prijs in het nieuwste jaar?
- Stap 3: Is het getal van het nieuwste jaar groter of kleiner dan het oudste jaar?
Trek pas na deze 3 stappen de definitieve conclusie of de prijs gestegen is of gedaald.`;

    const session = new LlamaChatSession({
        contextSequence: ctx.getSequence(),
        systemPrompt: SYSTEM_PROMPT,
    });
    console.log('Prompting...');
    const contextStr = 'DATABASE CONTEXT:\n[Artikel: 3RK1315-6NS71-0AA0 | Prijzen: 2021: €570 | 2023: €659 | 2025: €688 | 2026: €757]';
    const prompt = `Database context:\n${contextStr}\n\nVraag: Is de s7 serie van siemens de afgelopen 5 jaar gestegen of gedaald in prijs?`;

    const result = await session.prompt(prompt, { temperature: 0.1 });
    console.log('Result:', result);
    process.exit(0);
}
test();
