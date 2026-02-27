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
});
