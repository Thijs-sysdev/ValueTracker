/**
 * electron/main.js
 *
 * Electron main process.
 * - Starts the Next.js standalone server
 * - Opens a BrowserWindow
 * - Handles auto-updates via electron-updater + GitHub Releases
 */

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

// ── Config ──────────────────────────────────────────────────────────────────
const PORT = 3000;
const NEXT_SERVER = path.join(__dirname, '..', '.next', 'standalone', 'server.js');

let mainWindow = null;
let nextServerProcess = null;

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
        console.log('[next] Starting server at', NEXT_SERVER);

        nextServerProcess = spawn(process.execPath, [NEXT_SERVER], {
            env: {
                ...process.env,
                PORT: String(PORT),
                NODE_ENV: 'production',
                // Forward the data dir setting if set
                WAARDEBEPALING_DATA_DIR: process.env.WAARDEBEPALING_DATA_DIR || '',
            },
            stdio: 'inherit',
        });

        nextServerProcess.on('error', (err) => {
            console.error('[next] Failed to start:', err);
            reject(err);
        });

        // Poll until the server is ready
        const startTime = Date.now();
        const poll = setInterval(() => {
            http.get(`http://localhost:${PORT}`, (res) => {
                if (res.statusCode < 500) {
                    clearInterval(poll);
                    resolve();
                }
            }).on('error', () => {
                // Still starting up
                if (Date.now() - startTime > 30000) {
                    clearInterval(poll);
                    reject(new Error('Next.js server did not start in 30 seconds'));
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
        title: 'Waardebepaling OEV',
        icon: path.join(__dirname, '..', 'public', 'logo.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        backgroundColor: '#f8fafc',
        show: false,
    });

    mainWindow.loadURL(`http://localhost:${PORT}`);

    // Show window only when ready (avoids white flash)
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
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
        await startNextServer();
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
    if (nextServerProcess) {
        nextServerProcess.kill();
    }
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

app.on('will-quit', () => {
    if (nextServerProcess) {
        nextServerProcess.kill();
    }
});
