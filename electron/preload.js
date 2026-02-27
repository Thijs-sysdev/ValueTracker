/**
 * electron/preload.js
 *
 * Safely exposes the auto-updater IPC bridge to the renderer (React/Next.js).
 * Uses contextBridge so the renderer has NO direct Node.js access.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronUpdater', {
    // Listen for update events from the main process
    on: (channel, callback) => {
        const validChannels = [
            'updater:checking',
            'updater:available',
            'updater:not-available',
            'updater:progress',
            'updater:downloaded',
            'updater:error',
        ];
        if (validChannels.includes(channel)) {
            ipcRenderer.on(channel, (_event, data) => callback(data));
        }
    },

    // Remove a listener
    off: (channel, callback) => {
        ipcRenderer.removeListener(channel, callback);
    },

    // Trigger install now (quitAndInstall)
    installNow: () => {
        ipcRenderer.send('updater:install-now');
    },

    // Open GitHub releases page in browser
    openReleases: () => {
        ipcRenderer.send('updater:open-releases');
    },

    // True when running inside Electron
    isElectron: true,
});

contextBridge.exposeInMainWorld('electronAPI', {
    // Get the Windows username of the currently logged-in user
    getUsername: () => ipcRenderer.invoke('get-username'),

    // ── AI / LLM ──────────────────────────────────────────────────────────────
    ai: {
        /** Returns { isDownloaded, isLoaded, isLoading, isDownloading } */
        getModelStatus: () => ipcRenderer.invoke('ai:model-status'),

        /** Trigger the one-time model download */
        downloadModel: () => ipcRenderer.send('ai:download-model'),

        /** Ask the AI a question with optional RAG context (JSON string) */
        ask: (question, context, requestId) =>
            ipcRenderer.send('ai:ask', { question, context, requestId }),

        /** Event listeners for streaming responses */
        onDownloadProgress: (cb) => ipcRenderer.on('ai:download-progress', (_e, data) => cb(data)),
        onDownloadDone: (cb) => ipcRenderer.on('ai:download-done', () => cb()),
        onDownloadError: (cb) => ipcRenderer.on('ai:download-error', (_e, err) => cb(err)),
        onToken: (cb) => ipcRenderer.on('ai:token', (_e, data) => cb(data)),
        onDone: (cb) => ipcRenderer.on('ai:done', (_e, data) => cb(data)),
        onError: (cb) => ipcRenderer.on('ai:error', (_e, err) => cb(err)),

        /** Remove all AI listeners (call on component unmount) */
        removeAllListeners: () => {
            ['ai:download-progress', 'ai:download-done', 'ai:download-error',
                'ai:token', 'ai:done', 'ai:error'].forEach(ch => ipcRenderer.removeAllListeners(ch));
        },
    },
});
