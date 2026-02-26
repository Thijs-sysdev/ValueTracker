'use client';

import { useState } from 'react';
import { ValuationConfig } from '@/lib/types';
import { deleteConfig } from './actions';
import { Filter } from 'lucide-react';

export default function ConfigTable({ configs }: { configs: ValuationConfig[] }) {
    const [selectedBrand, setSelectedBrand] = useState<string>('All');

    // Extract unique brands
    const brands = Array.from(new Set(configs.map(c => c.manufacturer).filter(Boolean))) as string[];
    brands.sort((a, b) => a.localeCompare(b));

    const filteredConfigs = selectedBrand === 'All'
        ? configs
        : configs.filter(c => c.manufacturer === selectedBrand);

    return (
        <div className="glass-panel overflow-hidden rounded-[2rem] border border-slate-200/60 dark:border-slate-800 shadow-sm flex flex-col">
            <div className="p-4 lg:p-6 border-b border-slate-200/60 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Filter size={18} className="text-brand-500" />
                    Overzicht Configuraties
                </h3>
                {brands.length > 0 && (
                    <div className="flex items-center gap-3">
                        <label className="text-xs font-bold text-slate-500 uppercase shrink-0">Filter Merk:</label>
                        <select
                            value={selectedBrand}
                            onChange={(e) => setSelectedBrand(e.target.value)}
                            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm font-medium focus:ring-2 focus:ring-brand-500 outline-none transition-all cursor-pointer min-w-[150px] shadow-sm appearance-none"
                            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke-width='2' stroke='currentColor' class='text-slate-400'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M8 9l4-4 4 4m0 6l-4 4-4-4' /%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1em', paddingRight: '2.5rem' }}
                        >
                            <option value="All">Alle Merken</option>
                            {brands.map(brand => (
                                <option key={brand} value={brand}>{brand}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 uppercase tracking-wider bg-slate-100/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                            <th className="px-6 py-5 font-bold">Combinatie (Sleutel)</th>
                            <th className="px-6 py-5 font-bold text-right">Jaar 1 (%)</th>
                            <th className="px-6 py-5 font-bold text-right">Daarna (%)</th>
                            <th className="px-6 py-5 font-bold text-right">Straf NOB (%)</th>
                            <th className="px-6 py-5 font-bold text-center">Acties</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredConfigs.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                                    Geen configuraties gevonden {selectedBrand !== 'All' ? `voor ${selectedBrand}` : ''}.
                                </td>
                            </tr>
                        ) : (
                            filteredConfigs.map((config) => {
                                const deleteAction = deleteConfig.bind(null, config.key);
                                return (
                                    <tr key={config.key} className="hover:bg-white/60 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-6 py-5 font-semibold text-slate-900 dark:text-slate-100">
                                            <div>
                                                {config.manufacturer ? `${config.manufacturer} - ${config.category}` : config.key}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-right font-medium text-slate-600 dark:text-slate-300">
                                            {(config.depreciationYear1 * 100).toFixed(0)}%
                                        </td>
                                        <td className="px-6 py-5 text-right font-medium text-slate-600 dark:text-slate-300">
                                            {(config.depreciationSubsequent * 100).toFixed(0)}%
                                        </td>
                                        <td className="px-6 py-5 text-right font-medium text-slate-600 dark:text-slate-300">
                                            {(config.conditionPenaltyNOB * 100).toFixed(0)}%
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <form action={deleteAction}>
                                                <button type="submit" className="text-red-500 hover:text-red-700 hover:underline text-xs font-bold transition-colors">
                                                    Verwijderen
                                                </button>
                                            </form>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
