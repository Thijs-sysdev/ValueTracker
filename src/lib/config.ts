import { ValuationConfig } from './types';
import fs from 'fs';
import path from 'path';

const CONFIG_FILE_PATH = path.join(process.cwd(), 'data', 'config.json');

// Default initial config matrix based on the 'Configuratie' sheet in 'Waardebepaling berekeningen.xlsx'
const INITIAL_CONFIGURATION_MATRIX: Record<string, ValuationConfig> = {
    "SiemensPLC Materialen": {
        key: "SiemensPLC Materialen",
        manufacturer: "Siemens",
        category: "PLC Materialen",
        depreciationYear1: 0.5,
        depreciationSubsequent: 0.2,
        conditionPenaltyNOB: 0.2,
        conditionPenaltyNIBS: 0
    },
    "SiemensPower Supplies": {
        key: "SiemensPower Supplies",
        manufacturer: "Siemens",
        category: "Power Supplies",
        depreciationYear1: 0.4,
        depreciationSubsequent: 0.1,
        conditionPenaltyNOB: 0.2,
        conditionPenaltyNIBS: 0
    },
    "SiemensHMI en Displays": {
        key: "SiemensHMI en Displays",
        manufacturer: "Siemens",
        category: "HMI en Displays",
        depreciationYear1: 0.45,
        depreciationSubsequent: 0.2,
        conditionPenaltyNOB: 0.2,
        conditionPenaltyNIBS: 0
    },
    "SiemensFrequentieregelaars": {
        key: "SiemensFrequentieregelaars",
        manufacturer: "Siemens",
        category: "Frequentieregelaars",
        depreciationYear1: 0.58,
        depreciationSubsequent: 0.2,
        conditionPenaltyNOB: 0.2,
        conditionPenaltyNIBS: 0
    },
    "SiemensSchakelaarsenZekeringen Automaten MBS 5SJ": {
        key: "SiemensSchakelaarsenZekeringen Automaten MBS 5SJ",
        manufacturer: "Siemens",
        category: "SchakelaarsenZekeringen Automaten MBS 5SJ",
        depreciationYear1: 0.8,
        depreciationSubsequent: 0.1,
        conditionPenaltyNOB: 0.2,
        conditionPenaltyNIBS: 0
    },
    "SiemensServomotoren": {
        key: "SiemensServomotoren",
        manufacturer: "Siemens",
        category: "Servomotoren",
        depreciationYear1: 0.5,
        depreciationSubsequent: 0.1,
        conditionPenaltyNOB: 0.2,
        conditionPenaltyNIBS: 0
    },
    "LenzeFrequentieregelaars": {
        key: "LenzeFrequentieregelaars",
        manufacturer: "Lenze",
        category: "Frequentieregelaars",
        depreciationYear1: 0.4,
        depreciationSubsequent: 0.2,
        conditionPenaltyNOB: 0.2,
        conditionPenaltyNIBS: 0
    },
    "Allen BradleyPLC Materialen": {
        key: "Allen BradleyPLC Materialen",
        manufacturer: "Allen Bradley",
        category: "PLC Materialen",
        depreciationYear1: 0.4,
        depreciationSubsequent: 0.2,
        conditionPenaltyNOB: 0.2,
        conditionPenaltyNIBS: 0
    }
};

export async function getConfigMatrix(): Promise<Record<string, ValuationConfig>> {
    try {
        if (!fs.existsSync(CONFIG_FILE_PATH)) {
            // Ensure data directory exists
            const dir = path.dirname(CONFIG_FILE_PATH);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(INITIAL_CONFIGURATION_MATRIX, null, 2), 'utf-8');
            return INITIAL_CONFIGURATION_MATRIX;
        }

        const data = fs.readFileSync(CONFIG_FILE_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error("Error reading configuration matrix:", error);
        return INITIAL_CONFIGURATION_MATRIX;
    }
}

export async function saveConfigMatrix(matrix: Record<string, ValuationConfig>): Promise<void> {
    try {
        const dir = path.dirname(CONFIG_FILE_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(matrix, null, 2), 'utf-8');
    } catch (error) {
        console.error("Error saving configuration matrix:", error);
        throw error;
    }
}
