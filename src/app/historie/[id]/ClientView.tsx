'use client';

import Link from 'next/link';
import { Download, CheckCircle2, XCircle, ArrowLeft, User } from 'lucide-react';
import { HistoryItem } from '@/lib/types';

export default function HistoryDetailClient({ item }: { item: HistoryItem }) {
    const { results, fileName, totalSalesValue, acceptedItems, itemsProcessed, date } = item;

    const generateCSV = (type: 'consignment' | 'external') => {
        if (!results) return;

        // Filter accepted items only
        const accepted = results.filter(r => r.status === 'ACCEPTED');

        const lines = accepted.map(r => {
            const cost = type === 'consignment' ? r.purchase_value_consignment : r.purchase_value_external;
            const sku = r.sku ?? r.article_number;
            const qty = r.quantity ?? 1;
            const user = item.createdBy || 'Onbekend';
            return `${sku},${qty},${r.sales_value.toFixed(2)},${cost.toFixed(2)},${user}`;
        });

        const csvContent = "SKU,Aantal,SalesPrice,Cost(per piece),Gebruiker\n" + lines.join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `parttracker_historie_${type}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const acceptedRatio = itemsProcessed > 0 ? (acceptedItems / itemsProcessed) * 100 : 0;

    return (
        <div className="max-w-5xl mx-auto space-y-10 animate-in fade-in duration-700 pb-12">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <Link href="/historie" className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                            <ArrowLeft size={20} />
                        </Link>
                        <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                            Resultaat: {fileName}
                        </h2>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 max-w-2xl pl-11 flex items-center gap-4">
                        <span>Berekend op {new Date(date).toLocaleString('nl-NL')}</span>
                        {item.createdBy && (
                            <span className="flex items-center gap-1.5"><User size={14} /> {item.createdBy}</span>
                        )}
                    </p>
                </div>
            </div>

            <div className="space-y-8 animate-in slide-in-from-bottom-8 duration-700 delay-150 fill-mode-both">
                {/* Quick Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="glass-panel p-8 rounded-[2rem] flex flex-col gap-3 relative overflow-hidden group border border-slate-200/60 dark:border-slate-800">
                        <div className="absolute -right-8 -top-8 w-32 h-32 bg-brand-500/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700"></div>
                        <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Totale Verkoopwaarde</p>
                        <p className="text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                            €{totalSalesValue.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </p>
                    </div>

                    <div className="glass-panel p-8 rounded-[2rem] flex flex-col gap-3 relative overflow-hidden group border border-slate-200/60 dark:border-slate-800">
                        <div className="absolute -right-8 -top-8 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700"></div>
                        <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Verwerkte Artikelen</p>
                        <div className="flex items-baseline gap-2">
                            <p className="text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">{itemsProcessed}</p>
                            <p className="text-base font-bold text-slate-400">rijen</p>
                        </div>
                    </div>

                    <div className="glass-panel p-8 rounded-[2rem] flex flex-col gap-3 relative overflow-hidden group border border-slate-200/60 dark:border-slate-800">
                        <div className="absolute -right-8 -top-8 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700"></div>
                        <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Acceptatiegraad</p>
                        <p className="text-4xl lg:text-5xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400">
                            {Math.round(acceptedRatio)}%
                        </p>
                    </div>
                </div>

                {/* Action Bar */}
                <div className="flex flex-col sm:flex-row items-center justify-end gap-4 p-4 lg:p-6 glass-panel rounded-[2rem] border border-slate-200/60 dark:border-slate-800 shadow-sm">
                    <div className="flex flex-col sm:flex-row items-center w-full sm:w-auto gap-3">
                        <button
                            onClick={() => generateCSV('consignment')}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 text-sm font-bold bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-6 py-3.5 rounded-xl hover:opacity-90 shadow-md transition-all hover:-translate-y-0.5 active:translate-y-0"
                        >
                            <Download size={18} />
                            Export Consignatie
                        </button>
                        <button
                            onClick={() => generateCSV('external')}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 text-sm font-bold bg-gradient-to-r from-brand-600 to-brand-500 text-white px-6 py-3.5 rounded-xl hover:from-brand-500 hover:to-brand-400 shadow-lg shadow-brand-500/30 transition-all hover:-translate-y-0.5 active:translate-y-0"
                        >
                            <Download size={18} />
                            Export Extern
                        </button>
                    </div>
                </div>

                {/* Detailed Results Table */}
                <div className="glass-panel rounded-[2rem] overflow-hidden shadow-sm border border-slate-200/60 dark:border-slate-800">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-500 uppercase tracking-wider bg-slate-100/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                                <tr>
                                    <th className="px-6 py-5 font-bold">Artikelnummer</th>
                                    <th className="px-6 py-5 font-bold">Status</th>
                                    <th className="px-6 py-5 font-bold text-right text-slate-400">Bruto Prijs</th>
                                    <th className="px-6 py-5 font-bold text-right text-slate-400">Jaar</th>
                                    <th className="px-6 py-5 font-bold text-right">Verkoopwaarde</th>
                                    <th className="px-6 py-5 font-bold text-right text-slate-400">Inkoop Consignatie</th>
                                    <th className="px-6 py-5 font-bold text-right text-slate-400">Inkoop Extern</th>
                                    <th className="px-6 py-5 font-bold">Opmerking / Fout</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {results.slice(0, 100).map((row, idx) => (
                                    <tr key={idx} className="hover:bg-white/60 dark:hover:bg-slate-800/50 transition-colors group">
                                        <td className="px-6 py-5 font-semibold font-mono text-slate-900 dark:text-slate-100">
                                            <Link href={`/database?search=${encodeURIComponent(row.article_number)}`} className="text-brand-600 dark:text-brand-400 hover:text-brand-500 dark:hover:text-brand-300 hover:underline transition-colors" title="Bekijk prijshistorie">
                                                {row.article_number}
                                            </Link>
                                        </td>
                                        <td className="px-6 py-5">
                                            {row.status === 'ACCEPTED' ? (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 ring-1 ring-emerald-500/20">
                                                    <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-500" /> Geaccepteerd
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 ring-1 ring-red-500/20">
                                                    <XCircle size={14} className="text-red-600 dark:text-red-500" /> Afgewezen
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-5 text-right font-medium text-slate-500">
                                            {row.base_gross_price > 0 ? `€${row.base_gross_price.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}` : '-'}
                                        </td>
                                        <td className="px-6 py-5 text-right font-medium text-slate-500">
                                            {row.base_price_year > 0 ? row.base_price_year : '-'}
                                        </td>
                                        <td className="px-6 py-5 text-right font-bold text-slate-900 dark:text-white">
                                            {row.sales_value > 0 ? `€${row.sales_value.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}` : '-'}
                                        </td>
                                        <td className="px-6 py-5 text-right font-medium text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors">
                                            {row.purchase_value_consignment > 0 ? `€${row.purchase_value_consignment.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}` : '-'}
                                        </td>
                                        <td className="px-6 py-5 text-right font-medium text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors">
                                            {row.purchase_value_external > 0 ? `€${row.purchase_value_external.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}` : '-'}
                                        </td>
                                        <td className="px-6 py-5 font-medium text-xs max-w-[300px]" title={row.error || row.price_note}>
                                            {row.error ? (
                                                <span className="text-red-500/90 truncate block">{row.error}</span>
                                            ) : row.price_note ? (
                                                <span className="text-amber-600 dark:text-amber-500 block leading-snug">{row.price_note}</span>
                                            ) : (
                                                <span className="text-slate-300 dark:text-slate-700">-</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {results.length > 100 && (
                            <div className="p-4 text-center text-sm font-medium text-slate-500 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800">
                                Er worden {results.length - 100} extra items verborgen in deze weergave. (<span className="text-brand-600 dark:text-brand-400">Deze zitten wel volledig in de export .csv</span>)
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
