'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { UploadCloud, FileSpreadsheet, Loader2, Download, CheckCircle2, XCircle, AlertCircle, Info, Calculator, FileText, Settings as SettingsIcon } from 'lucide-react';
import { processValuationFile } from './actions';
import { ValuationOutput } from '@/lib/types';

export default function Dashboard() {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<ValuationOutput[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Restore results from sessionStorage on mount
  useEffect(() => {
    const saved = sessionStorage.getItem('parttracker_valuation_results');
    if (saved) {
      try {
        setResults(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse cached valuation:", e);
      }
    }
  }, []);

  // Sync results to sessionStorage
  useEffect(() => {
    if (results) {
      sessionStorage.setItem('parttracker_valuation_results', JSON.stringify(results));
    } else if (results === null && !isLoading) {
      // Don't remove if we are just briefly setting to null during loading
      // Actually, removing is safer unless user navigates back
      sessionStorage.removeItem('parttracker_valuation_results');
    }
  }, [results, isLoading]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) await handleFileUpload(file);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await handleFileUpload(file);
  };

  const handleFileUpload = async (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setError("Zorg ervoor dat je een geldig Excel (.xlsx of .xls) bestand uploadt.");
      return;
    }

    setError(null);
    setIsLoading(true);
    setResults(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await processValuationFile(formData);

      if (response.success && response.data) {
        setResults(response.data);
      } else {
        setError(response.error || "Er is een onbekende fout opgetreden tijdens de analyse.");
      }
    } catch {
      setError("Er ging iets mis met het verbinden met de server.");
    } finally {
      setIsLoading(false);
    }
  };

  const generateCSV = (type: 'consignment' | 'external') => {
    if (!results) return;

    // Filter accepted items only
    const accepted = results.filter(r => r.status === 'ACCEPTED');

    const lines = accepted.map(r => {
      const cost = type === 'consignment' ? r.purchase_value_consignment : r.purchase_value_external;
      return `${r.sku},${r.quantity},${r.sales_value.toFixed(2)},${cost.toFixed(2)}`;
    });

    const csvContent = "SKU,Aantal,SalesPrice,Cost(per piece)\n" + lines.join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `parttracker_import_${type}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalCalculatedSales = results?.reduce((acc, curr) => acc + curr.sales_value, 0) || 0;
  const acceptedRatio = results ? (results.filter(r => r.status === 'ACCEPTED').length / results.length) * 100 : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-10 animate-in fade-in duration-700 pb-12 pt-6">

      {/* Hero Section */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-2 text-slate-900 dark:text-white">Waarde bepaling</h2>
          <p className="text-slate-500 dark:text-slate-400 max-w-2xl">
            Upload een Parttracker Excel-bestand (of klantsjabloon) om direct de afschrijving, conditiestraffen en inkoopwaarde te berekenen.
          </p>
        </div>
        <a
          href="/sjabloon-oev-v4-overtollige-artikelen-parttracker.xlsx"
          download="Sjabloon_Waardebepaling.xlsx"
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-500 bg-slate-800/20 hover:bg-slate-800/60 hover:text-slate-300 border border-slate-700/30 hover:border-slate-700/80 rounded-xl transition-all h-fit"
          title="Download referentie sjabloon"
        >
          <Download size={16} />
          <span>Sjabloon</span>
        </a>
      </div>

      {/* Upload Zone */}
      {
        !results && !isLoading && (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative overflow-hidden rounded-[2.5rem] border-2 border-dashed p-16 md:p-24 text-center transition-all duration-500 ${isDragging
              ? 'border-brand-400 bg-brand-50/80 dark:bg-brand-900/20 scale-[1.02] shadow-2xl shadow-brand-500/10'
              : 'border-slate-300 dark:border-slate-700 hover:border-brand-400/60 hover:bg-white/60 dark:hover:bg-slate-800/40 hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-none'
              } glass-panel cursor-pointer group`}
          >
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileSelect}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className="flex flex-col items-center justify-center gap-6 pointer-events-none">
              <div className={`p-6 rounded-3xl transition-all duration-500 ${isDragging ? 'bg-brand-500 text-white scale-110 shadow-lg shadow-brand-500/30' : 'bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 shadow-md group-hover:bg-brand-50 group-hover:text-brand-600 dark:group-hover:bg-brand-900/50 group-hover:scale-105'}`}>
                <FileSpreadsheet size={56} strokeWidth={1.5} />
              </div>
              <div className="space-y-2">
                <p className="text-2xl font-bold dark:text-slate-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                  Selecteer of sleep een Excel bestand
                </p>
                <p className="text-base text-slate-400 font-medium">
                  Ondersteunt .xlsx en .xls formaat
                </p>
              </div>
            </div>
          </div>
        )
      }

      {/* Loading State */}
      {
        isLoading && (
          <div className="rounded-[2.5rem] border border-slate-200/60 dark:border-slate-800 p-24 text-center glass-panel flex flex-col items-center justify-center gap-8 shadow-xl shadow-slate-200/30 dark:shadow-none">
            <div className="relative">
              <div className="absolute inset-0 bg-brand-500 blur-xl opacity-20 animate-pulse rounded-full"></div>
              <Loader2 className="w-16 h-16 text-brand-500 animate-spin relative z-10" />
            </div>
            <p className="text-xl font-medium animate-pulse text-slate-600 dark:text-slate-300">
              Intelligente berekeningen uitvoeren...
            </p>
          </div>
        )
      }

      {/* Error Message */}
      {
        error && !isLoading && (
          <div className="rounded-3xl border border-red-200 bg-red-50/80 p-8 flex items-start gap-4 text-red-800 dark:bg-red-950/30 dark:border-red-900/50 dark:text-red-400 animate-in slide-in-from-top-4 shadow-lg shadow-red-100/50">
            <AlertCircle className="shrink-0 mt-1 w-6 h-6" />
            <div className="space-y-2">
              <h4 className="text-lg font-bold">Fout bij verwerken</h4>
              <p className="opacity-90 leading-relaxed font-medium">{error}</p>
              <button
                onClick={() => setError(null)}
                className="mt-4 px-4 py-2 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 rounded-xl text-sm font-bold hover:bg-red-200 dark:hover:bg-red-900 transition-colors"
              >
                Probeer opnieuw
              </button>
            </div>
          </div>
        )
      }

      {/* Results Dashboard */}
      {
        results && !isLoading && (
          <div className="space-y-8 animate-in slide-in-from-bottom-8 duration-700">

            {/* Quick Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="glass-panel p-8 rounded-[2rem] flex flex-col gap-3 relative overflow-hidden group border border-slate-200/60 dark:border-slate-800">
                <div className="absolute -right-8 -top-8 w-32 h-32 bg-brand-500/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700"></div>
                <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Totale Verkoopwaarde</p>
                <p className="text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  €{totalCalculatedSales.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </p>
              </div>

              <div className="glass-panel p-8 rounded-[2rem] flex flex-col gap-3 relative overflow-hidden group border border-slate-200/60 dark:border-slate-800">
                <div className="absolute -right-8 -top-8 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700"></div>
                <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Verwerkte Artikelen</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">{results?.length || 0}</p>
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
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 lg:p-6 glass-panel rounded-[2rem] border border-slate-200/60 dark:border-slate-800 shadow-sm">
              <button
                onClick={() => setResults(null)}
                className="w-full sm:w-auto text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-5 py-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
              >
                <UploadCloud size={18} />
                Nieuw Bestand Uploaden
              </button>
              <div className="flex flex-col sm:flex-row items-center w-full sm:w-auto gap-3" >
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
                    {results?.slice(0, 50).map((row, idx) => (
                      <tr key={idx} className="hover:bg-white/60 dark:hover:bg-slate-800/50 transition-colors group">
                        <td className="px-6 py-5 font-semibold font-mono text-slate-900 dark:text-slate-100">
                          <Link href={`/beheer?search=${encodeURIComponent(row.article_number)}`} className="text-brand-600 dark:text-brand-400 hover:text-brand-500 dark:hover:text-brand-300 hover:underline transition-colors" title="Bekijk prijshistorie">
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
                {results && results.length > 50 && (
                  <div className="p-4 text-center text-sm font-medium text-slate-500 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800">
                    Er worden {results.length - 50} extra items verborgen in deze weergave overzicht. (<span className="text-brand-600 dark:text-brand-400">Deze zitten wel volledig in de export .csv</span>)
                  </div>
                )}
              </div>
            </div>

          </div>
        )
      }
    </div >
  );
}
