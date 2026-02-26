/**
 * dataPath.ts
 *
 * Central module for resolving the data directory path.
 *
 * Priority order:
 *  1. WAARDEBEPALING_DATA_DIR environment variable (useful for Electron / testing)
 *  2. Settings file at %APPDATA%/ValueTracker/settings.json  → { "dataDir": "..." }
 *  3. Fallback: ./data/ relative to process.cwd() (default for local dev / home PC)
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

const SETTINGS_FILE = path.join(
    os.homedir(),
    'AppData',
    'Roaming',
    'ValueTracker',
    'settings.json'
);

interface AppSettings {
    dataDir?: string;
    priceListsDir?: string;
}

/**
 * Returns the absolute path to the data directory.
 * Reads configurations fresh to prevent multi-worker desync.
 */
export function getDataDir(): string {
    // 1. Environment variable override (used by Electron or CI)
    if (process.env.WAARDEBEPALING_DATA_DIR) {
        console.log(`[dataPath] Using env override: ${process.env.WAARDEBEPALING_DATA_DIR}`);
        return process.env.WAARDEBEPALING_DATA_DIR;
    }

    // 2. Settings file (persisted per-machine configuration)
    try {
        if (fs.existsSync(SETTINGS_FILE)) {
            const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
            const settings: AppSettings = JSON.parse(raw);
            if (settings.dataDir && fs.existsSync(settings.dataDir)) {
                console.log(`[dataPath] Using configured data dir: ${settings.dataDir}`);
                return settings.dataDir;
            }
        }
    } catch (e) {
        console.warn('[dataPath] Could not read settings file, falling back to default.', e);
    }

    // 3. Default fallback: ./data/ next to the running process
    const defaultDataDir = path.join(process.cwd(), 'data');
    console.log(`[dataPath] Using default data dir: ${defaultDataDir}`);
    return defaultDataDir;
}

/**
 * Returns the absolute path to the price lists directory.
 * Reads configurations fresh to prevent multi-worker desync.
 */
export function getPriceListsDir(): string {
    // 1. Settings file (persisted per-machine configuration)
    try {
        if (fs.existsSync(SETTINGS_FILE)) {
            const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
            const settings: AppSettings = JSON.parse(raw);
            if (settings.priceListsDir && fs.existsSync(settings.priceListsDir)) {
                console.log(`[dataPath] Using configured price lists dir: ${settings.priceListsDir}`);
                return settings.priceListsDir;
            }
        }
    } catch (e) {
        console.warn('[dataPath] Could not read settings file for price lists dir, falling back to default.', e);
    }

    // 2. Default fallback: ./uploaded_pricelists/ inside the main data dir
    const defaultPriceListsDir = path.join(getDataDir(), 'uploaded_pricelists');
    console.log(`[dataPath] Using default price lists dir: ${defaultPriceListsDir}`);
    // Ensure default directory exists
    if (!fs.existsSync(defaultPriceListsDir)) {
        fs.mkdirSync(defaultPriceListsDir, { recursive: true });
    }
    return defaultPriceListsDir;
}

/**
 * Returns the full path to a specific data file.
 * Example: getDataFilePath('config.json') → 'C:\Users\...\data\config.json'
 */
export function getDataFilePath(filename: string): string {
    return path.join(getDataDir(), filename);
}

/**
 * Saves a new data directory path to the settings file.
 * Called from the settings/setup UI.
 */
export function saveDataDirSetting(newDataDir: string): void {
    const settingsDir = path.dirname(SETTINGS_FILE);
    if (!fs.existsSync(settingsDir)) {
        fs.mkdirSync(settingsDir, { recursive: true });
    }

    // Read existing settings to not overwrite priceListsDir
    let currentSettings: AppSettings = {};
    if (fs.existsSync(SETTINGS_FILE)) {
        try {
            currentSettings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
        } catch { }
    }

    const newSettings: AppSettings = { ...currentSettings, dataDir: newDataDir };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(newSettings, null, 2), 'utf-8');

    console.log(`[dataPath] Saved new data dir setting: ${newDataDir}`);
}

/**
 * Saves a new price lists directory path to the settings file.
 */
export function savePriceListsDirSetting(newDir: string): void {
    const settingsDir = path.dirname(SETTINGS_FILE);
    if (!fs.existsSync(settingsDir)) {
        fs.mkdirSync(settingsDir, { recursive: true });
    }

    // Read existing settings to not overwrite dataDir
    let currentSettings: AppSettings = {};
    if (fs.existsSync(SETTINGS_FILE)) {
        try {
            currentSettings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
        } catch { }
    }

    const newSettings: AppSettings = { ...currentSettings, priceListsDir: newDir };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(newSettings, null, 2), 'utf-8');

    console.log(`[dataPath] Saved new price lists dir setting: ${newDir}`);
}

/**
 * Returns the current settings file path (for display in the UI).
 */
export function getSettingsFilePath(): string {
    return SETTINGS_FILE;
}

/**
 * Resets the resolved cache. Useful after saving a new setting.
 */
export function resetDataDirCache(): void {
    // No-op
}
