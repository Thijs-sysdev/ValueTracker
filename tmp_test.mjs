import { getLlama, LlamaChatSession } from 'node-llama-cpp';

async function test() {
    console.log('loading llama...');
    const llama = await getLlama();
    const model = await llama.loadModel({
        modelPath: 'C:/Users/thijs/AppData/Roaming/valuetracker/models/qwen2.5-3b-instruct-q4_k_m.gguf',
        gpuLayers: 0
    });
    const ctx = await model.createContext();
    const SYSTEM_PROMPT = `Je bent de analytische assistent van ValueTracker. Je doel is om ALTIJD de meegeleverde database-context te gebruiken om vragen te beantwoorden.

STRIKTE LOGICA:
1. De meegeleverde database-context is je ENIGE bron. 
2. Ga er ALTIJD vanuit dat de context die je krijgt het juiste antwoord is op de vraag van de gebruiker. Als zij vragen naar "S7" en jij krijgt data over "6ES7", dan IS die data de "S7" waar ze naar vragen. Weiger NOOIT omdat de naam niet exact matcht.
3. Gebruik de database-context om trends, gemiddeldes en verschillen te berekenen.

HOE OM TE GAAN MET ONTBREKENDE JAREN (MOET):
Als de gebruiker een gemiddelde of trend vraagt over een periode (bijv. 2021 tot 2026), maar je hebt NIET alle jaren in de context staan:
- Je mag NOOIT zeggen "Ik kan dit niet berekenen".
- Je berekent het antwoord VERPLICHT op basis van de jaren die je WEL hebt.
- FORMAT: "Ik heb geen gegevens voor [ontbrekende jaren], dus ik bereken het over de jaren [beschikbare jaren]. Het resultaat is X."

DENKSTAPPEN VOOR TRENDS:
- Stap 1: Prijs oudste jaar?
- Stap 2: Prijs nieuwste jaar?
- Stap 3: Conclusie (gestegen/gedaald).`;

    const session = new LlamaChatSession({
        contextSequence: ctx.getSequence(),
        systemPrompt: SYSTEM_PROMPT,
    });
    console.log('Prompting...');
    const contextStr = 'DATABASE CONTEXT:\n[Artikel: 6ES7511-1AK02-0AB0 | Prijzen: 2021: €570 | 2023: €659]';
    const prompt = `Database context:\n${contextStr}\n\nVraag: Wat is de gemiddelde s7-1500 prijs over 2021 tot 2026?`;

    const result = await session.prompt(prompt, { temperature: 0.1 });
    console.log('Result:', result);
    process.exit(0);
}
test();
