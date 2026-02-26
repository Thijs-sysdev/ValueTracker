'use server';

import { getDataDir, getSettingsFilePath, saveDataDirSetting, resetDataDirCache } from '@/lib/dataPath';
import { clearPriceListCache } from '@/lib/priceList';
import fs from 'fs';

export async function getDataDirSettings() {
    return {
        currentDataDir: getDataDir(),
        settingsFile: getSettingsFilePath(),
        isDefault: !fs.existsSync(getSettingsFilePath()),
    };
}

export async function updateDataDir(newDataDir: string): Promise<{ success: boolean; error?: string }> {
    try {
        if (!newDataDir || newDataDir.trim() === '') {
            return { success: false, error: 'Pad mag niet leeg zijn.' };
        }

        const trimmed = newDataDir.trim();

        // Validate the path exists
        if (!fs.existsSync(trimmed)) {
            return { success: false, error: `Map bestaat niet: ${trimmed}` };
        }

        saveDataDirSetting(trimmed);
        resetDataDirCache();
        clearPriceListCache();

        return { success: true };
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        return { success: false, error: message };
    }
}

export async function resetDataDir(): Promise<{ success: boolean }> {
    try {
        const settingsFile = getSettingsFilePath();
        if (fs.existsSync(settingsFile)) {
            fs.unlinkSync(settingsFile);
        }
        resetDataDirCache();
        clearPriceListCache();
        return { success: true };
    } catch {
        return { success: false };
    }
}
