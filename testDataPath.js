const path = require('path');
const os = require('os');
const fs = require('fs');

const SETTINGS_FILE = path.join(
    os.homedir(),
    'AppData',
    'Roaming',
    'ValueTracker',
    'settings.json'
);

function printDataDir() {
    let _resolvedDataDir = null;
    if (process.env.WAARDEBEPALING_DATA_DIR) {
        _resolvedDataDir = process.env.WAARDEBEPALING_DATA_DIR;
        console.log(`[dataPath] Using env override: ${_resolvedDataDir}`);
        return _resolvedDataDir;
    }

    try {
        if (fs.existsSync(SETTINGS_FILE)) {
            const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
            const settings = JSON.parse(raw);
            console.log("Read settings:", settings);
            if (settings.dataDir && fs.existsSync(settings.dataDir)) {
                _resolvedDataDir = settings.dataDir;
                console.log(`[dataPath] Using configured data dir: ${_resolvedDataDir}`);
                return _resolvedDataDir;
            } else {
                console.log("settings.dataDir missing or not exists. Exists?", fs.existsSync(settings.dataDir));
            }
        }
    } catch (e) {
        console.warn('[dataPath] Could not read settings file, falling back to default.', e);
    }

    _resolvedDataDir = path.join(process.cwd(), 'data');
    console.log(`[dataPath] Using default data dir: ${_resolvedDataDir}`);
    return _resolvedDataDir;
}

printDataDir();
