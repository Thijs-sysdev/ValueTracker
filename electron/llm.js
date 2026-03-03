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

const SYSTEM_PROMPT = `Je bent de analytische assistent van ValueTracker. Je doel is om ALTIJD de meegeleverde database-context te gebruiken om vragen te beantwoorden.

STRIKTE LOGICA:
1. De meegeleverde database-context is je ENIGE bron.
2. Beantwoord EXACT de vraag van de gebruiker — als zij specifieke jaren vragen (bijv. 2025 vs 2026), geef dan ALLEEN die jaren terug. Gooi geen extra jaren in de context erbij tenzij de gebruiker dat vraagt.
3. Als zij vragen naar "categorieën", gebruik dan de CATEGORIEËN sector uit de context.

PRIJSANALYSE (CATEGORIE-MODUS):
Als de context een tabel bevat met categorieën en jaren (=== PRIJSANALYSE: ... (per Categorie) ===):
- Presenteer de tabel exact zoals hij is in je antwoord.
- Voeg DAARNA een korte samenvatting toe van de top 3 categorieën die het meeste zijn gestegen en de top 3 die het meeste zijn gedaald.
- Gebruik de ↑ ↓ → symbolen om snel te communiceren.
- Schrijf in eenvoudig Nederlands, gericht op een inkoper.

PRIJSANALYSE (TREND-MODUS):
Als de context een eenvoudige jaaroverzicht heeft (=== PRIJSANALYSE: ... ===):
- Analyseer richting van de trend (stijgend/dalend/stabiel).
- Bereken het totale procentuele verschil van het eerste naar het laatste jaar.
- Schrijf in MAXIMAAL 5 zinnen (de grafiek toont de data al).

HOE OM TE GAAN MET ONTBREKENDE JAREN:
- Als gevraagde jaren niet in de context staan: verklaar dit expliciet.
- Bereken altijd op basis van beschikbare Data, nooit meer.`;


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
