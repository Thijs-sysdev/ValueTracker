/**
 * electron/llm.js
 *
 * Local LLM Manager — 100% offline, runs in Electron main process.
 *
 * Responsibilities:
 *  - Check if the Qwen2.5-3B-Instruct GGUF model is present.
 *  - Download the model on first use (with progress events).
 *  - Load the model into memory (lazy, on first AI request).
 *  - Answer questions using the RAG pattern:
 *      1. Caller provides context (price data from the DB).
 *      2. System prompt strictly grounds the LLM to that context.
 *      3. Streams tokens back via a callback.
 */

const path = require('path');
const fs = require('fs');
const https = require('https');
const { app } = require('electron');

// ── Configuration ─────────────────────────────────────────────────────────────

const MODEL_NAME = 'qwen2.5-3b-instruct-q4_k_m.gguf';

// HuggingFace direct download URL for Qwen2.5-3B-Instruct Q4_K_M
const MODEL_URL =
    'https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf';

const MODELS_DIR = path.join(app.getPath('userData'), 'models');
const MODEL_PATH = path.join(MODELS_DIR, MODEL_NAME);

// ── System prompt (guardrails) ─────────────────────────────────────────────────

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
Trek pas na deze 3 stappen de definitieve conclusie of de prijs gestegen is of gedaald.

OMGAAN MET ONTBREKENDE DATA:
Als een gebruiker naar een specifieke periode vraagt (bijv. 2021 tot 2026), maar sommige referentiejaren ontbreken in de database-context:
1. Meld EERST expliciet en duidelijk welke gevraagde jaren ontbreken.
2. Weiger NIET om antwoord te geven. Bereken in plaats daarvan direct het antwoord (zoals een gemiddelde of verschil) op basis van de jaren die WEL beschikbaar zijn in de context.
3. Vermeld duidelijk op welke specifieke jaren jouw berekening is gebaseerd.`;

// ── State ──────────────────────────────────────────────────────────────────────

let llmInstance = null;       // the loaded LlamaCpp model object
let isLoading = false;        // prevent double-loading
let isDownloading = false;    // prevent double-download

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Returns the current status of the model.
 * Called by renderer to show the correct UI state.
 */
function getModelStatus() {
    return {
        isDownloaded: fs.existsSync(MODEL_PATH),
        isLoaded: llmInstance !== null,
        isLoading,
        isDownloading,
        modelPath: MODEL_PATH,
        modelName: MODEL_NAME,
    };
}

/**
 * Downloads the GGUF model file to the userData/models directory.
 * Reports progress via the `onProgress` callback: { percent, receivedMB, totalMB }
 */
function downloadModel(onProgress, onDone, onError) {
    if (isDownloading) {
        onError(new Error('Download is already in progress.'));
        return;
    }

    // Ensure the models directory exists
    if (!fs.existsSync(MODELS_DIR)) {
        fs.mkdirSync(MODELS_DIR, { recursive: true });
    }

    isDownloading = true;
    console.log('[llm] Starting model download from HuggingFace...');

    const tempPath = MODEL_PATH + '.tmp';
    const file = fs.createWriteStream(tempPath);

    const makeRequest = (url, redirectCount = 0) => {
        if (redirectCount > 10) {
            isDownloading = false;
            onError(new Error('Too many redirects during model download.'));
            return;
        }

        https.get(url, (response) => {
            // Handle redirects (HuggingFace CDN uses them)
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                makeRequest(response.headers.location, redirectCount + 1);
                return;
            }

            if (response.statusCode !== 200) {
                isDownloading = false;
                file.close();
                fs.unlinkSync(tempPath);
                onError(new Error(`Download failed with HTTP ${response.statusCode}`));
                return;
            }

            const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
            let receivedBytes = 0;

            response.on('data', (chunk) => {
                receivedBytes += chunk.length;
                if (totalBytes > 0) {
                    const percent = Math.round((receivedBytes / totalBytes) * 100);
                    const receivedMB = (receivedBytes / 1024 / 1024).toFixed(0);
                    const totalMB = (totalBytes / 1024 / 1024).toFixed(0);
                    onProgress({ percent, receivedMB, totalMB });
                }
            });

            response.pipe(file);

            file.on('finish', () => {
                file.close(() => {
                    // Rename temp file to final name only on success
                    fs.renameSync(tempPath, MODEL_PATH);
                    isDownloading = false;
                    console.log('[llm] Model download complete:', MODEL_PATH);
                    onDone();
                });
            });
        }).on('error', (err) => {
            isDownloading = false;
            file.close();
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
            onError(err);
        });
    };

    makeRequest(MODEL_URL);
}

/**
 * Loads the model into memory using node-llama-cpp.
 * This is called lazily on the first AI request.
 */
async function loadModel() {
    if (llmInstance) return llmInstance;
    if (isLoading) {
        // Wait until loading completes
        await new Promise((resolve) => {
            const interval = setInterval(() => {
                if (!isLoading) { clearInterval(interval); resolve(); }
            }, 200);
        });
        return llmInstance;
    }

    if (!fs.existsSync(MODEL_PATH)) {
        throw new Error('Model not downloaded yet. Call downloadModel first.');
    }

    isLoading = true;
    console.log('[llm] Loading model into memory:', MODEL_PATH);

    try {
        const { getLlama, LlamaChatSession } = await import('node-llama-cpp');
        const os = require('os');
        const logicalCores = os.cpus().length;

        const llama = await getLlama();
        const model = await llama.loadModel({
            modelPath: MODEL_PATH,
            gpuLayers: 'max', // Force offload to GPU (RTX 4070 Ti)
            useMlock: true // Prevent swapping to disk
        });
        const context = await model.createContext({
            contextSize: 2048, // Halved from 4096 to save RAM and speed up eval
            threads: Math.max(1, logicalCores - 1) // Leave 1 core for OS/Electron UI, use the rest
        });
        const session = new LlamaChatSession({
            contextSequence: context.getSequence(),
            systemPrompt: SYSTEM_PROMPT,
        });

        llmInstance = { llama, model, context, session, LlamaChatSession };
        console.log('[llm] Model loaded and ready.');
    } catch (err) {
        console.error('[llm] Failed to load model:', err);
        isLoading = false;
        throw err;
    }

    isLoading = false;
    return llmInstance;
}

/**
 * Main entry point: ask the LLM a question.
 *
 * @param {string} question     - The user's natural language question.
 * @param {string} context      - JSON string of relevant price DB records.
 * @param {function} onToken    - Called for each streamed token (string).
 * @returns {Promise<string>}   - The full answer text.
 */
async function ask(question, context, onToken) {
    const instance = await loadModel();

    // Re-use the existing session and clear its history to avoid context bleed
    // CRITICAL FIX: setChatHistory([]) deletes the System Prompt in node-llama-cpp! 
    // We must pass the System Prompt back as the first message element.
    const session = instance.session;
    session.setChatHistory([{ type: 'system', text: SYSTEM_PROMPT }]);
    if (session.sequence && typeof session.sequence.clearHistory === 'function') {
        session.sequence.clearHistory();
    }

    // Build the prompt with the database context injected
    const prompt = context
        ? `Database context (gebruik ALLEEN deze data):\n${context}\n\nVraag: ${question}`
        : `Vraag: ${question}`;

    let fullResponse = '';

    await session.prompt(prompt, {
        temperature: 0.1,          // 0.1 allows enough flexibility to break out of hallucinated loops without sacrificing logic
        maxTokens: 512,
        onTextChunk: (token) => {
            fullResponse += token;
            if (onToken) onToken(token);
        },
    });

    return fullResponse;
}

module.exports = { getModelStatus, downloadModel, loadModel, ask };
