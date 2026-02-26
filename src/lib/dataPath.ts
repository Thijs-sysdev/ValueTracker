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
}

let _resolvedDataDir: string | null = null;

/**
 * Returns the absolute path to the data directory.
 * Result is cached after the first call.
 */
export function getDataDir(): string {
    if (_resolvedDataDir) return _resolvedDataDir;

    // 1. Environment variable override (used by Electron or CI)
    if (process.env.WAARDEBEPALING_DATA_DIR) {
        _resolvedDataDir = process.env.WAARDEBEPALING_DATA_DIR;
        console.log(`[dataPath] Using env override: ${_resolvedDataDir}`);
        return _resolvedDataDir;
    }

    // 2. Settings file (persisted per-machine configuration)
    try {
        if (fs.existsSync(SETTINGS_FILE)) {
            const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
            const settings: AppSettings = JSON.parse(raw);
            if (settings.dataDir && fs.existsSync(settings.dataDir)) {
                _resolvedDataDir = settings.dataDir;
                console.log(`[dataPath] Using configured data dir: ${_resolvedDataDir}`);
                return _resolvedDataDir;
            }
        }
    } catch (e) {
        console.warn('[dataPath] Could not read settings file, falling back to default.', e);
    }

    // 3. Default fallback: ./data/ next to the running process
    _resolvedDataDir = path.join(process.cwd(), 'data');
    console.log(`[dataPath] Using default data dir: ${_resolvedDataDir}`);
    return _resolvedDataDir;
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
    const settings: AppSettings = { dataDir: newDataDir };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');

    // Reset cache so next call picks up the new value
    _resolvedDataDir = null;
    console.log(`[dataPath] Saved new data dir setting: ${newDataDir}`);
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
    _resolvedDataDir = null;
}
