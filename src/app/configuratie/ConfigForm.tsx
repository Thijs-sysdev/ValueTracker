'use client';

import { useState } from 'react';
import { addOrUpdateConfig } from './actions';
import { Loader2, Plus } from 'lucide-react';

export default function ConfigForm() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    async function handleSubmit(formData: FormData) {
        setIsLoading(true);
        setError(null);
        setSuccess(false);

        try {
            const result = await addOrUpdateConfig(formData);
            if (result.success) {
                setSuccess(true);
                const form = document.getElementById('config-form') as HTMLFormElement;
                if (form) form.reset();
            } else {
                setError(result.error || "Fout bij opslaan");
            }
        } catch {
            setError("Netwerk fout");
        } finally {
            setIsLoading(false);
            setTimeout(() => setSuccess(false), 3000);
        }
    }

    return (
        <div className="glass-panel p-6 rounded-[2rem] border border-slate-200/60 dark:border-slate-800 shadow-sm relative overflow-hidden group">
            <h3 className="text-xl font-bold mb-4 text-slate-900 dark:text-white flex items-center gap-2">
                Nieuwe Configuratie
            </h3>

            <form id="config-form" action={handleSubmit} className="space-y-4">
                {error && <div className="text-red-500 text-sm font-bold p-3 bg-red-50 rounded-xl">{error}</div>}
                {success && <div className="text-emerald-500 text-sm font-bold p-3 bg-emerald-50 rounded-xl">Succesvol opgeslagen!</div>}

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5 col-span-2 md:col-span-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Merk</label>
                        <input name="manufacturer" required type="text" placeholder="bijv. Sick" className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/50 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-brand-500 outline-none transition-all" />
                    </div>
                    <div className="space-y-1.5 col-span-2 md:col-span-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Categorie</label>
                        <input name="category" required type="text" placeholder="bijv. Power Supply" className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/50 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-brand-500 outline-none transition-all" />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase">Afschrijving Jaar 1 (%)</label>
                    <input name="depreciationYear1" required type="number" step="0.1" min="0" max="100" defaultValue="50" className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/50 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-brand-500 outline-none transition-all" />
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase">Afschrijving Daarna Per Jaar (%)</label>
                    <input name="depreciationSubsequent" required type="number" step="0.1" min="0" max="100" defaultValue="20" className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/50 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-brand-500 outline-none transition-all" />
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase">Conditie Straf NOB (%)</label>
                    <input name="conditionPenaltyNOB" required type="number" step="0.1" min="0" max="100" defaultValue="20" className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/50 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-brand-500 outline-none transition-all" />
                </div>

                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full mt-4 flex items-center justify-center gap-2 text-sm font-bold bg-gradient-to-r from-brand-600 to-brand-500 text-white px-6 py-3.5 rounded-xl hover:from-brand-500 hover:to-brand-400 shadow-md shadow-brand-500/30 transition-all active:scale-95 disabled:opacity-70"
                >
                    {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                    Configuratie Opslaan
                </button>
            </form>
        </div>
    );
}
