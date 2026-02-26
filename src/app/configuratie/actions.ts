'use server';

import { getConfigMatrix, saveConfigMatrix } from '@/lib/config';
import { ValuationConfig } from '@/lib/types';
import { revalidatePath } from 'next/cache';

export async function addOrUpdateConfig(formData: FormData) {
    try {
        const manufacturer = formData.get('manufacturer')?.toString().trim() || "";
        const category = formData.get('category')?.toString().trim() || "";
        const depreciationYear1 = parseFloat(formData.get('depreciationYear1')?.toString() || "0");
        const depreciationSubsequent = parseFloat(formData.get('depreciationSubsequent')?.toString() || "0");
        const conditionPenaltyNOB = parseFloat(formData.get('conditionPenaltyNOB')?.toString() || "0");

        if (!manufacturer || !category) {
            return { success: false, error: "Merk en Categorie zijn verplicht." };
        }

        const lookupKey = `${manufacturer}${category}`;

        const newConfig: ValuationConfig = {
            key: lookupKey,
            manufacturer,
            category,
            depreciationYear1: isNaN(depreciationYear1) ? 0 : depreciationYear1 / 100,
            depreciationSubsequent: isNaN(depreciationSubsequent) ? 0 : depreciationSubsequent / 100,
            conditionPenaltyNOB: isNaN(conditionPenaltyNOB) ? 0 : conditionPenaltyNOB / 100,
            conditionPenaltyNIBS: 0 // Default or not used dynamically right now
        };

        const configMatrix = await getConfigMatrix();
        configMatrix[lookupKey] = newConfig;

        await saveConfigMatrix(configMatrix);

        revalidatePath('/configuratie');
        return { success: true };
    } catch (error) {
        console.error("Fout bij opslaan configuratie:", error);
        return { success: false, error: "Er is een fout opgetreden bij het opslaan." };
    }
}

export async function deleteConfig(key: string): Promise<void> {
    try {
        const configMatrix = await getConfigMatrix();
        if (configMatrix[key]) {
            delete configMatrix[key];
            await saveConfigMatrix(configMatrix);
            revalidatePath('/configuratie');
        }
    } catch (error) {
        console.error("Fout bij verwijderen configuratie:", error);
    }
}
