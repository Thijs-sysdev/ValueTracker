import * as fs from 'fs';
import * as path from 'path';
import { HistoryItem } from './types';
import { getDataFilePath } from './dataPath';

const getHistoryFilePath = () => getDataFilePath('history.json');

export function getHistories(): HistoryItem[] {
    const filePath = getHistoryFilePath();
    if (!fs.existsSync(filePath)) {
        return [];
    }
    try {
        const rawData = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(rawData);
    } catch (e) {
        console.error("Failed to parse history.json:", e);
        return [];
    }
}

export function getHistoryById(id: string): HistoryItem | null {
    const histories = getHistories();
    return histories.find(h => h.id === id) || null;
}

export function saveHistory(item: HistoryItem): void {
    const histories = getHistories();
    histories.unshift(item); // Add to the beginning
    const filePath = getHistoryFilePath();

    // Ensure data directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, JSON.stringify(histories, null, 2), 'utf-8');
}
