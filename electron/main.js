/**
 * electron/main.js
 *
 * Electron main process.
 * - Starts the Next.js standalone server (via require, not spawn)
 * - Opens a BrowserWindow
 * - Handles auto-updates via electron-updater + GitHub Releases
 */

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const http = require('http');

// ── Config ──────────────────────────────────────────────────────────────────
const PORT = 3000;
const IS_DEV = !app.isPackaged;
const NEXT_SERVER = IS_DEV
    ? path.join(__dirname, '..', '.next', 'standalone', 'server.js')
    : path.join(__dirname, '..', '..', 'app.asar.unpacked', '.next', 'standalone', 'server.js');

let mainWindow = null;

// ── Auto-updater setup ───────────────────────────────────────────────────────
autoUpdater.autoDownload = true;        // silently download in background
autoUpdater.autoInstallOnAppQuit = true; // install when the user quits

function setupAutoUpdater() {
    autoUpdater.on('checking-for-update', () => {
        sendToRenderer('updater:checking');
    });

    autoUpdater.on('update-available', (info) => {
        sendToRenderer('updater:available', info);
    });

    autoUpdater.on('update-not-available', () => {
        sendToRenderer('updater:not-available');
    });

    autoUpdater.on('download-progress', (progress) => {
        sendToRenderer('updater:progress', progress);
    });

    autoUpdater.on('update-downloaded', (info) => {
        sendToRenderer('updater:downloaded', info);
    });

    autoUpdater.on('error', (err) => {
        console.error('[updater] Error:', err.message);
        sendToRenderer('updater:error', { message: err.message });
    });
}

// IPC: renderer asks to install update now
ipcMain.on('updater:install-now', () => {
    autoUpdater.quitAndInstall(false, true);
});

// IPC: renderer asks to open the releases page
ipcMain.on('updater:open-releases', () => {
    shell.openExternal('https://github.com/Thijs-sysdev/OEV/releases');
});

function sendToRenderer(channel, data) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(channel, data);
    }
}

// ── Next.js server ───────────────────────────────────────────────────────────
function startNextServer() {
    return new Promise((resolve, reject) => {
        console.log('[next] Loading standalone server from:', NEXT_SERVER);

        // Set required environment variables BEFORE requiring server.js
        process.env.PORT = String(PORT);
        process.env.NODE_ENV = 'production';
        process.env.HOSTNAME = '127.0.0.1';

        // In the packaged app, Next.js standalone server.js uses __dirname-relative
        // paths. We need to set the correct working directory so it finds its files.
        const standaloneDir = path.dirname(NEXT_SERVER);

        try {
            // Because .next/standalone is now in app.asar.unpacked,
            // standaloneDir is a real physical folder!
            // We MUST change the directory to it so Next.js finds its files.
            process.chdir(standaloneDir);
        } catch (e) {
            console.warn('[next] Could not chdir to standalone env:', e.message);
        }

        // require() starts the server in-process — no child process needed.
        // This is the correct way to embed Next.js standalone in Electron.
        try {
            require(NEXT_SERVER);
        } catch (err) {
            console.error('[next] Failed to load server.js:', err);
            reject(err);
            return;
        }

        // Poll until the HTTP server is actually accepting connections
        const startTime = Date.now();
        const poll = setInterval(() => {
            http.get(`http://127.0.0.1:${PORT}`, (res) => {
                if (res.statusCode < 500) {
                    clearInterval(poll);
                    console.log('[next] Server ready on port', PORT);
                    resolve();
                }
                res.resume(); // consume response to free socket
            }).on('error', () => {
                if (Date.now() - startTime > 30000) {
                    clearInterval(poll);
                    reject(new Error('Next.js server did not start within 30 seconds'));
                }
            });
        }, 500);
    });
}

// ── Window ───────────────────────────────────────────────────────────────────
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 900,
        minHeight: 600,
        title: 'ValueTracker',
        icon: path.join(__dirname, '..', 'public', 'logo.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        backgroundColor: '#f8fafc',
        show: false,
    });

    mainWindow.loadURL(`http://127.0.0.1:${PORT}`);

    // Show window only when ready (avoids white flash)
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        // In dev mode, open DevTools for debugging
        if (IS_DEV) {
            mainWindow.webContents.openDevTools();
        }
    });

    // Open external links in the system browser
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
    try {
        if (IS_DEV) {
            // In dev mode, Next.js is already running via `npm run dev`
            // Just wait for it to be ready
            console.log('[main] Dev mode: waiting for Next.js dev server...');
            await new Promise((resolve, reject) => {
                const startTime = Date.now();
                const poll = setInterval(() => {
                    http.get(`http://127.0.0.1:${PORT}`, (res) => {
                        if (res.statusCode < 500) {
                            clearInterval(poll);
                            resolve();
                        }
                        res.resume();
                    }).on('error', () => {
                        if (Date.now() - startTime > 60000) {
                            clearInterval(poll);
                            reject(new Error('Dev server not ready in 60s'));
                        }
                    });
                }, 500);
            });
        } else {
            // Production: start the embedded Next.js standalone server
            await startNextServer();
        }

        createWindow();
        setupAutoUpdater();

        // Check for updates 5 seconds after start (giving the UI time to load)
        setTimeout(() => {
            autoUpdater.checkForUpdates().catch((err) => {
                console.warn('[updater] Check failed (offline?):', err.message);
            });
        }, 5000);
    } catch (err) {
        console.error('[main] Fatal error:', err);
        app.quit();
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
