'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { UploadCloud, FileSpreadsheet, Loader2, Download, CheckCircle2, XCircle, AlertCircle, Database, X } from 'lucide-react';
import { processValuationFile, exportEnrichedValuation, finalizePriceUpdates } from './actions';

import { ValuationOutput, PriceUpdateCandidate } from '@/lib/types';

export default function Dashboard() {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [results, setResults] = useState<ValuationOutput[] | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Consent modal state
  const [priceUpdateCandidates, setPriceUpdateCandidates] = useState<PriceUpdateCandidate[]>([]);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [pendingResults, setPendingResults] = useState<ValuationOutput[] | null>(null);
  const [isFinalizingUpdates, setIsFinalizingUpdates] = useState(false);


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
    setOriginalFile(file);


    try {
      const formData = new FormData();
      formData.append('file', file);

      // Get the real Windows username via Electron IPC at runtime.
      // Falls back to 'Onbekend' in web/dev environments.
      const username: string = (typeof window !== 'undefined' && (window as any).electronAPI?.getUsername)
        ? await (window as any).electronAPI.getUsername()
        : 'Onbekend';
      formData.append('username', username);

      const response = await processValuationFile(formData);

      if (response.success && response.data) {
        const candidates = response.price_update_candidates ?? [];
        if (candidates.length > 0) {
          // Stop: toon eerst de consent modal zodat de gebruiker kan kiezen
          setPriceUpdateCandidates(candidates);
          setPendingResults(response.data);
          setShowConsentModal(true);
        } else {
          // Geen conflicten: toon de resultaten direct
          setResults(response.data);
        }
      } else {
        setError(response.error || "Er is een onbekende fout opgetreden tijdens de analyse.");
      }
    } catch {
      setError("Er ging iets mis met het verbinden met de server.");
    } finally {
      setIsLoading(false);
    }
  };

  /** Gebruiker accepteert het overschrijven van de database */
  const handleConsentAccept = async () => {
    setIsFinalizingUpdates(true);
    try {
      await finalizePriceUpdates(priceUpdateCandidates);
    } catch {
      // Fout bij opslaan, maar we gaan toch door naar de resultaten
    } finally {
      setResults(pendingResults);
      setPendingResults(null);
      setPriceUpdateCandidates([]);
      setShowConsentModal(false);
      setIsFinalizingUpdates(false);
    }
  };

  /** Gebruiker weigert het overschrijven — toon resultaten zonder DB-update */
  const handleConsentDecline = () => {
    setResults(pendingResults);
    setPendingResults(null);
    setPriceUpdateCandidates([]);
    setShowConsentModal(false);
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

  const handleExportEnriched = async () => {
    if (!results || !originalFile) return;
    setIsExporting(true);
    try {
      const formData = new FormData();
      formData.append('file', originalFile);
      formData.append('results', JSON.stringify(results));

      const response = await exportEnrichedValuation(formData);

      if (response.success && response.base64 && response.fileName) {
        const binaryString = atob(response.base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', response.fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        setError(response.error || 'Er ging iets mis met het exporteren.');
      }
    } catch {
      setError('Er ging iets mis met het verbinden met de server.');
    } finally {
      setIsExporting(false);
    }
  };

  const totalCalculatedSales = results?.reduce((acc, curr) => acc + curr.sales_value, 0) || 0;
  const acceptedRatio = results ? (results.filter(r => r.status === 'ACCEPTED').length / results.length) * 100 : 0;


  return (
    <div className="max-w-[98%] mx-auto space-y-10 animate-in fade-in duration-700 pb-12 pt-6">

      {/* ── Consent Modal: Overschrijven van databaseprijzen ── */}
      {showConsentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center gap-3 p-6 border-b border-slate-200 dark:border-slate-800 bg-amber-50 dark:bg-amber-950/30">
              <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/50">
                <Database size={22} className="text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Prijzen overschrijven in database?</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Voor de volgende {priceUpdateCandidates.length} artikel{priceUpdateCandidates.length !== 1 ? 'en' : ''} staat er een afwijkende prijs in het importbestand.
                </p>
              </div>
            </div>

            {/* Modal Body — tabel met kandidaten */}
            <div className="overflow-y-auto max-h-72">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase tracking-wider bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-5 py-3 font-bold">Artikelnummer</th>
                    <th className="px-5 py-3 font-bold">Omschrijving</th>
                    <th className="px-5 py-3 font-bold text-right">Huidige DB-prijs</th>
                    <th className="px-5 py-3 font-bold text-right">Nieuwe prijs</th>
                    <th className="px-5 py-3 font-bold text-right">Jaar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {priceUpdateCandidates.map((c, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-3 font-mono font-semibold text-slate-900 dark:text-slate-100">{c.article_number}</td>
                      <td className="px-5 py-3 text-slate-500 dark:text-slate-400 max-w-[180px] truncate" title={c.description}>{c.description || '—'}</td>
                      <td className="px-5 py-3 text-right text-slate-500">€{c.existing_price.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}</td>
                      <td className="px-5 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">€{c.imported_price.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}</td>
                      <td className="px-5 py-3 text-right text-slate-500">{c.year}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
              <p className="text-xs text-slate-400 dark:text-slate-500">
                In beide gevallen worden de waardeberekeningen uitgevoerd.
              </p>
              <div className="flex gap-3 w-full sm:w-auto">
                <button
                  onClick={handleConsentDecline}
                  disabled={isFinalizingUpdates}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                >
                  <X size={16} />
                  Niet accepteren
                </button>
                <button
                  onClick={handleConsentAccept}
                  disabled={isFinalizingUpdates}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-amber-500 hover:bg-amber-400 dark:bg-amber-600 dark:hover:bg-amber-500 shadow-md shadow-amber-500/20 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:translate-y-0"
                >
                  {isFinalizingUpdates ? <Loader2 size={16} className="animate-spin" /> : <Database size={16} />}
                  {isFinalizingUpdates ? 'Opslaan...' : 'Accepteren & opslaan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-2 text-slate-900 dark:text-white">Waarde bepaling</h2>
          <p className="text-slate-500 dark:text-slate-400 max-w-2xl">
            Upload een Parttracker Excel-bestand (of klantsjabloon) om direct de afschrijving, conditiestraffen en inkoopwaarde te berekenen.
          </p>
        </div>
        <a
          href="/sjabloon-valuetracker-overtollige-artikelen-parttracker.xlsx"
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
                <button
                  onClick={handleExportEnriched}
                  disabled={isExporting || !originalFile}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 text-sm font-bold bg-gradient-to-r from-emerald-600 to-emerald-500 text-white px-6 py-3.5 rounded-xl hover:from-emerald-500 hover:to-emerald-400 shadow-lg shadow-emerald-500/30 transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0"
                >
                  {isExporting ? <Loader2 size={18} className="animate-spin" /> : <FileSpreadsheet size={18} />}
                  {isExporting ? 'Bezig...' : 'Exporteer inkoopvoorstel'}
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
                    {results?.map((row, idx) => (
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
                          <div className="flex items-center justify-end gap-2">
                            {row.is_from_database && (
                              <span title="Prijs uit database" className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 ring-1 ring-blue-400/20">
                                <Database size={9} /> DB
                              </span>
                            )}
                            {row.base_gross_price > 0 ? `€${row.base_gross_price.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}` : '-'}
                          </div>
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
                            <span className="block space-y-0.5">
                              {row.price_note.split('\n').map((line, i) => (
                                <span key={i} className="block leading-snug text-amber-600 dark:text-amber-500">{line}</span>
                              ))}
                            </span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-700">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )
      }
    </div >
  );
}
