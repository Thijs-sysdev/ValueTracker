'use client';

import { useState, useEffect } from 'react';
import { UploadCloud, Database, Loader2, Link as LinkIcon, AlertCircle, CheckCircle2, RefreshCw, FileText, ChevronDown, Search, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getDatabaseStats, uploadPriceListAction, searchArticleHistory, checkPriceListAction } from './actions';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

// Helper function to normalize brand names for grouping in the filter
function normalizeBrandName(name: string): string {
    if (!name) return 'Onbekend';
    const lower = name.toLowerCase().trim();
    if (lower.includes('beckhoff') || lower.includes('beckhof')) return 'Beckhoff';
    if (lower.includes('wago')) return 'Wago';
    if (lower.includes('weidmuller') || lower.includes('weidmüller')) return 'Weidmüller';
    if (lower.includes('phoenix')) return 'Phoenix Contact';
    if (lower.includes('siemens')) return 'Siemens';
    if (lower.includes('schneider')) return 'Schneider';
    if (lower.includes('abb')) return 'ABB';
    if (lower.includes('festo')) return 'Festo';
    if (lower.includes('sick')) return 'Sick';
    if (lower.includes('nidec')) return 'Nidec';

    // Capitalize first letter of each word as a fallback
    return lower.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

export default function DatabaseBeheer() {
    const router = useRouter();
    const [isDeepLinked, setIsDeepLinked] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isStatsLoading, setIsStatsLoading] = useState(true);
    const [stats, setStats] = useState<any>(null);
    const [message, setMessage] = useState<{ text: string, type: 'error' | 'success' } | null>(null);
    const [showData, setShowData] = useState(false);

    // Filter states for dataset table
    const [filterBrand, setFilterBrand] = useState<string>('');
    const [filterYear, setFilterYear] = useState<string>('');
    const [searchFile, setSearchFile] = useState<string>('');

    // Upload confirmation dialog state
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [checkResult, setCheckResult] = useState<any>(null);
    const [confirmStep, setConfirmStep] = useState<'closed' | 'warning' | 'sure'>('closed');
    const [isChecking, setIsChecking] = useState(false);

    // Product Search State
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearching, setIsSearching] = useState(false);
    const [searchResult, setSearchResult] = useState<any>(null);
    const [searchError, setSearchError] = useState<string | null>(null);

    useEffect(() => {
        fetchStats();

        // Auto-search if ?search= parameter is present
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const searchParam = params.get('search');
            if (searchParam) {
                setSearchQuery(searchParam);
                setIsDeepLinked(true);
                performSearch(searchParam);
            }
        }
    }, []);

    const fetchStats = async () => {
        setIsStatsLoading(true);
        const res = await getDatabaseStats();
        if (res.success) {
            setStats(res);
        }
        setIsStatsLoading(false);
    };

    const performSearch = async (query: string) => {
        if (!query.trim()) return;

        setIsSearching(true);
        setSearchError(null);
        setSearchResult(null);

        try {
            const result = await searchArticleHistory(query);
            if (result) {
                setSearchResult(result);
            } else {
                setSearchError("Product niet gevonden in de database.");
            }
        } catch (err) {
            setSearchError("Fout bij het zoeken.");
        } finally {
            setIsSearching(false);
        }
    };

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
            setMessage({ text: "Zorg ervoor dat je een geldig Excel (.xlsx of .xls) bestand uploadt.", type: 'error' });
            return;
        }

        setMessage(null);
        setIsChecking(true);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const check = await checkPriceListAction(formData);

            if (!check.success) {
                setMessage({ text: check.error || "Fout bij controle van bestand.", type: 'error' });
                setIsChecking(false);
                return;
            }

            setPendingFile(file);
            setCheckResult(check);

            // Always show the info/warning modal so the user can see what's happening
            setConfirmStep('warning');
        } catch (err: any) {
            const errMsg = err?.message || (typeof err === 'string' ? err : null);
            setMessage({ text: errMsg ? `Fout: ${errMsg}` : "Er ging iets mis met de verbinding.", type: 'error' });
        } finally {
            setIsChecking(false);
        }
    };

    const handleConfirmUpload = () => {
        if (checkResult?.yearAlreadyExists) {
            // Ask for a second confirmation
            setConfirmStep('sure');
        } else {
            // No duplicate — proceed directly
            executeUpload();
        }
    };

    const handleFinalConfirm = () => {
        executeUpload();
    };

    const handleCancelUpload = () => {
        setConfirmStep('closed');
        setPendingFile(null);
        setCheckResult(null);
    };

    const executeUpload = async () => {
        if (!pendingFile) return;
        setConfirmStep('closed');
        setIsLoading(true);
        try {
            const formData = new FormData();
            formData.append('file', pendingFile);
            const response = await uploadPriceListAction(formData);
            if (response.success) {
                setMessage({ text: response.message || "Succes!", type: 'success' });
                await fetchStats();
            } else {
                setMessage({ text: response.error || "Fout bij verwerken lijst.", type: 'error' });
            }
        } catch (err: any) {
            const errMsg = err?.message || (typeof err === 'string' ? err : null);
            setMessage({ text: errMsg ? `Fout: ${errMsg}` : "Er ging iets mis met de verbinding.", type: 'error' });
        } finally {
            setIsLoading(false);
            setPendingFile(null);
            setCheckResult(null);
        }
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        performSearch(searchQuery);
    };

    // Calculate chart statistics if a result exists
    let chartData = [];
    let minPrice = 0;
    let maxPrice = 0;
    let avgChangePct = 0;
    let avgChangeEur = 0;
    let latestPrice = 0;
    let trend = 'neutral';

    if (searchResult && searchResult.history && searchResult.history.length > 0) {
        const historyMap = new Map();
        searchResult.history.forEach((h: any) => historyMap.set(h.year, h.price));

        const minYear = Math.min(...searchResult.history.map((h: any) => h.year));
        let maxYear = Math.max(new Date().getFullYear(), Math.max(...searchResult.history.map((h: any) => h.year)));

        for (let y = minYear; y <= maxYear; y++) {
            chartData.push({
                year: y.toString(),
                prijs: historyMap.has(y) ? historyMap.get(y) : null
            });
        }

        const prices = searchResult.history.map((h: any) => h.price);
        minPrice = Math.min(...prices);
        maxPrice = Math.max(...prices);
        latestPrice = prices[prices.length - 1];

        if (searchResult.history.length > 1) {
            const first = searchResult.history[0];
            const last = searchResult.history[searchResult.history.length - 1];
            const yearsDiff = last.year - first.year;

            if (yearsDiff > 0) {
                avgChangeEur = (last.price - first.price) / yearsDiff;
                const totalPctChange = ((last.price - first.price) / first.price) * 100;
                avgChangePct = totalPctChange / yearsDiff;
            }

            if (avgChangeEur > 0) trend = 'up';
            else if (avgChangeEur < 0) trend = 'down';
        }
    }

    // Derived state for dataset table filters
    const allMetadata = stats?.metadata || [];

    // Get unique brands and years for dropdowns
    const uniqueBrands = Array.from(new Set(allMetadata.map((m: any) => normalizeBrandName(m.manufacturer)))).sort() as string[];
    const uniqueYears = Array.from(new Set(allMetadata.map((m: any) => m.year?.toString()))).sort().reverse() as string[];

    // Filter the metadata
    const filteredMetadata = allMetadata.filter((meta: any) => {
        const matchBrand = filterBrand ? normalizeBrandName(meta.manufacturer) === filterBrand : true;
        const matchYear = filterYear ? meta.year?.toString() === filterYear : true;
        const matchFile = searchFile ? meta.fileName?.toLowerCase().includes(searchFile.toLowerCase()) : true;
        return matchBrand && matchYear && matchFile;
    });

    return (
        <div className="max-w-5xl mx-auto space-y-10 animate-in fade-in duration-700 pb-12">

            {/* Upload Validation Modal */}
            {confirmStep !== 'closed' && checkResult && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md animate-in zoom-in-95 duration-200">

                        {confirmStep === 'warning' && (
                            <>
                                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-start gap-4">
                                    <div className={`shrink-0 p-2.5 rounded-xl ${checkResult.yearAlreadyExists
                                        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                                        : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                                        }`}>
                                        {checkResult.yearAlreadyExists
                                            ? <AlertCircle className="w-6 h-6" />
                                            : <CheckCircle2 className="w-6 h-6" />}
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                                            {checkResult.yearAlreadyExists ? 'Prijslijst al aanwezig' : 'Nieuwe Prijslijst'}
                                        </h4>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">
                                            {checkResult.yearAlreadyExists
                                                ? `Er is al een prijslijst voor ${checkResult.manufacturer} in ${checkResult.years?.join(', ')} geïmporteerd op ${new Date(checkResult.existingUploadDates?.[0] || new Date()).toLocaleDateString('nl-NL', { day: '2-digit', month: 'long', year: 'numeric' })}.`
                                                : `Prijslijst voor ${checkResult.manufacturer} (${checkResult.years?.join(', ')}) — nog niet eerder geïmporteerd.`}
                                        </p>
                                    </div>
                                </div>

                                <div className="p-6 space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-center">
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Totaal Artikelen</p>
                                            <p className="text-2xl font-extrabold text-slate-900 dark:text-white">{checkResult.totalArticles?.toLocaleString('nl-NL')}</p>
                                        </div>
                                        <div className={`rounded-xl p-3 text-center ${checkResult.newArticlesCount > 0
                                            ? 'bg-brand-50 dark:bg-brand-900/20'
                                            : 'bg-slate-50 dark:bg-slate-800'
                                            }`}>
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Nieuwe Codes</p>
                                            <p className={`text-2xl font-extrabold ${checkResult.newArticlesCount > 0
                                                ? 'text-brand-600 dark:text-brand-400'
                                                : 'text-slate-500'
                                                }`}>{checkResult.newArticlesCount?.toLocaleString('nl-NL')}</p>
                                        </div>
                                    </div>

                                    {checkResult.newArticlesCount === 0 && !checkResult.yearAlreadyExists && (
                                        <p className="text-xs text-slate-400 text-center">Alle artikelcodes zijn al bekend in de database. Prijzen worden bijgewerkt.</p>
                                    )}

                                    <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40 rounded-xl">
                                        <svg className="w-4 h-4 text-blue-500 dark:text-blue-400 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                                        <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                                            Van <strong>alle {checkResult.totalArticles?.toLocaleString('nl-NL')} artikelen</strong> wordt een prijs voor <strong>{checkResult.years?.join(', ')}</strong> opgeslagen in de database — ook de al bestaande codes krijgen een bijgewerkte prijs voor dit jaar.
                                        </p>
                                    </div>
                                </div>

                                <div className="px-6 pb-6 flex gap-3">
                                    <button
                                        onClick={handleCancelUpload}
                                        className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                    >
                                        Annuleren
                                    </button>
                                    <button
                                        onClick={handleConfirmUpload}
                                        className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold text-white transition-colors ${checkResult.yearAlreadyExists
                                            ? 'bg-amber-500 hover:bg-amber-400'
                                            : 'bg-brand-600 hover:bg-brand-500'
                                            }`}
                                    >
                                        {checkResult.yearAlreadyExists ? 'Toch Uploaden →' : 'Upload Bevestigen'}
                                    </button>
                                </div>
                            </>
                        )}

                        {confirmStep === 'sure' && (
                            <>
                                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-start gap-4">
                                    <div className="shrink-0 p-2.5 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                                        <AlertCircle className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Weet je het zeker?</h4>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">
                                            De bestaande prijzen voor <strong>{checkResult.manufacturer} {checkResult.years?.join(', ')}</strong> worden overschreven. Dit kan niet ongedaan worden gemaakt.
                                        </p>
                                    </div>
                                </div>
                                <div className="px-6 py-6 flex gap-3">
                                    <button
                                        onClick={handleCancelUpload}
                                        className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                    >
                                        Annuleren
                                    </button>
                                    <button
                                        onClick={handleFinalConfirm}
                                        className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-sm font-bold text-white transition-colors"
                                    >
                                        Ja, overschrijven
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 dark:border-slate-800 pb-6 glass-panel p-6 rounded-2xl relative overflow-hidden group">
                <div className="absolute -left-12 -top-12 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl"></div>
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-slate-900 dark:bg-white rounded-lg">
                            <Database className="w-5 h-5 text-white dark:text-slate-900" />
                        </div>
                        <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Database Beheer</h2>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400">
                        Upload hier nieuwe prijslijsten van leveranciers. Deze worden direct aan het collectieve geheugen van de applicatie toegevoegd.
                    </p>
                </div>

                <Link
                    href="/"
                    className="flex items-center gap-2 text-sm font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl hover:shadow-md transition-all z-10 hover:-translate-y-0.5"
                >
                    <LinkIcon size={16} />
                    Naar Waardebepaling
                </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left Column: Upload */}
                <div className="md:col-span-2 space-y-6">
                    <h3 className="text-xl font-bold">Nieuwe Prijslijst Toevoegen</h3>

                    <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`relative overflow-hidden rounded-2xl border-2 border-dashed p-12 text-center transition-all duration-300 ${isDragging
                            ? 'border-brand-500 bg-brand-50/80 dark:bg-brand-900/20 scale-102'
                            : 'border-slate-300 dark:border-slate-700 hover:border-brand-400 hover:bg-white dark:hover:bg-slate-800/80'
                            } glass-panel cursor-pointer group`}
                    >
                        <input
                            type="file"
                            accept=".xlsx, .xls"
                            onChange={handleFileSelect}
                            disabled={isLoading || isChecking}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
                        />

                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center gap-4">
                                <Loader2 className="w-12 h-12 text-brand-500 animate-spin" />
                                <p className="font-medium animate-pulse">Prijzen uit bestand in database laden...</p>
                            </div>
                        ) : isChecking ? (
                            <div className="flex flex-col items-center justify-center gap-4">
                                <Loader2 className="w-12 h-12 text-brand-500 animate-spin" />
                                <p className="font-medium animate-pulse">Bestand controleren...</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center gap-4 pointer-events-none">
                                <div className={`p-4 rounded-full transition-all duration-500 ${isDragging ? 'bg-brand-500 text-white rotate-12' : 'bg-slate-100 text-slate-400 dark:bg-slate-900 group-hover:bg-brand-50 group-hover:text-brand-500 group-hover:-translate-y-1'}`}>
                                    <UploadCloud size={40} strokeWidth={1.5} />
                                </div>
                                <div>
                                    <p className="text-lg font-semibold text-slate-800 dark:text-slate-200">Sleep de Leveranciers Excel hier</p>
                                    <p className="text-sm text-slate-500 mt-1">.xlsx, .xls (max 50MB)</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Notification Area */}
                    {message && (
                        <div className={`rounded-xl border p-4 flex items-start gap-3 animate-in slide-in-from-top-2 ${message.type === 'error'
                            ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-900/50 dark:text-red-400'
                            : 'bg-green-50 border-green-200 text-green-800 dark:bg-green-950/30 dark:border-green-900/50 dark:text-green-400'
                            }`}>
                            {message.type === 'error' ? <AlertCircle className="shrink-0 mt-0.5 w-5 h-5" /> : <CheckCircle2 className="shrink-0 mt-0.5 w-5 h-5" />}
                            <div className="text-sm font-medium leading-snug">
                                {message.text}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Column: Stats */}
                <div className="space-y-6">
                    <h3 className="text-xl font-bold flex items-center justify-between">
                        Database Status
                        <button onClick={fetchStats} className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                            <RefreshCw size={18} className={isStatsLoading ? 'animate-spin' : ''} />
                        </button>
                    </h3>

                    <div className="glass-panel p-6 rounded-2xl flex flex-col gap-4 relative overflow-hidden">
                        <div className="absolute -right-12 -top-12 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl"></div>

                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Aantal Artikelen</p>
                            {isStatsLoading ? (
                                <div className="h-10 w-32 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                            ) : (
                                <p className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                                    {stats?.totalItems?.toLocaleString('nl-NL') || 0}
                                </p>
                            )}
                        </div>

                        <div className="h-px bg-slate-200 dark:bg-slate-800/50 w-full my-1"></div>

                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Unieke Merken</p>
                            {isStatsLoading ? (
                                <div className="h-8 w-16 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
                            ) : (
                                <p className="text-2xl font-bold tracking-tight text-brand-600 dark:text-brand-400">
                                    {stats?.uniqueManufacturers || 0}
                                </p>
                            )}
                        </div>

                        <div className="mt-2 p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-xl">
                            <p className="text-xs font-semibold text-slate-500 mb-1">Top Merken in DB:</p>
                            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                                {isStatsLoading ? 'Laden...' : (stats?.topManufacturers || 'Geen data gevonden')}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Product History Search */}
            <div className="space-y-4 pt-4 border-t border-slate-200/50 dark:border-slate-800/50">
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        <Search className="w-5 h-5 text-brand-500" />
                        Prijshistorie Zoeken
                    </h3>
                </div>

                <form onSubmit={handleSearch} className="flex gap-3">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Voer een artikelnummer in (bijv. 6ES7...)"
                        className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500/50 dark:text-white"
                    />
                    <button
                        type="submit"
                        disabled={isSearching || !searchQuery.trim()}
                        className="bg-brand-600 hover:bg-brand-500 text-white font-bold py-3 px-6 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
                    >
                        {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                        Zoeken
                    </button>
                </form>

                {searchError && (
                    <div className="flex flex-col gap-4">
                        <div className="p-4 bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-800/50 text-sm font-medium">
                            {searchError}
                        </div>
                        {isDeepLinked && (
                            <div className="flex justify-start">
                                <button
                                    onClick={() => router.back()}
                                    className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-700 bg-slate-100 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all border border-slate-200 dark:border-slate-700 shadow-sm"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                    </svg>
                                    Terug naar Waardebepaling RESULTATEN
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {searchResult && (
                    <div className="glass-panel p-6 rounded-2xl border border-slate-200/60 dark:border-slate-800 animate-in slide-in-from-bottom-4 flex flex-col gap-6">

                        {/* Deep link back button */}
                        {isDeepLinked && (
                            <div className="flex justify-start">
                                <button
                                    onClick={() => router.back()}
                                    className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-700 bg-slate-100 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all border border-slate-200 dark:border-slate-700 shadow-sm"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                    </svg>
                                    Terug naar Waardebepaling RESULTATEN
                                </button>
                            </div>
                        )}

                        {/* Fuzzy match notice */}
                        {searchResult._fuzzy_matched_key && (
                            <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-xl text-xs text-amber-800 dark:text-amber-400 font-medium">
                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>
                                    Exact artikel niet gevonden. Dichtstbijzijnde match getoond: <span className="font-mono font-bold">{searchResult._fuzzy_matched_key}</span>
                                </span>
                            </div>
                        )}
                        <div className="flex flex-col sm:flex-row justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
                            <div>
                                <p className="text-brand-600 dark:text-brand-400 text-sm font-bold uppercase tracking-wider mb-1">
                                    {searchResult.manufacturer}
                                </p>
                                <h4 className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
                                    {searchResult.article_number}
                                </h4>
                            </div>

                            <div className="flex flex-wrap gap-4">
                                <div className="bg-slate-50 dark:bg-slate-800/50 px-5 py-3 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Actuele Prijs</p>
                                    <p className="text-2xl font-bold text-slate-900 dark:text-white">€{latestPrice.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}</p>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-800/50 px-5 py-3 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Gem. Prijstrend / jr</p>
                                    <div className="flex items-center gap-2">
                                        <p className={`text-xl font-bold ${trend === 'up' ? 'text-red-500' : trend === 'down' ? 'text-emerald-500' : 'text-slate-500'}`}>
                                            {trend === 'up' ? '+' : ''}{avgChangeEur.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                                        </p>
                                        <div className={`px-2 py-0.5 rounded-full text-xs font-bold ${trend === 'up' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : trend === 'down' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400'}`}>
                                            {trend === 'up' ? <TrendingUp size={12} className="inline mr-1" /> : trend === 'down' ? <TrendingDown size={12} className="inline mr-1" /> : <Minus size={12} className="inline mr-1" />}
                                            {avgChangePct > 0 ? '+' : ''}{avgChangePct.toFixed(1)}%
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Chart Area */}
                        {chartData.length > 1 ? (
                            <div className="h-[300px] w-full mt-4">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                                        <XAxis
                                            dataKey="year"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
                                            dy={10}
                                        />
                                        <YAxis
                                            domain={['dataMin - (dataMin * 0.05)', 'dataMax + (dataMax * 0.05)']}
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
                                            tickFormatter={(val) => `€${Math.round(val)}`}
                                            dx={-10}
                                        />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', backgroundColor: '#1e293b', color: '#f8fafc', fontWeight: 'bold' }}
                                            itemStyle={{ color: '#38bdf8' }}
                                            formatter={(value) => [`€${Number(value).toLocaleString('nl-NL', { minimumFractionDigits: 2 })}`, 'Prijs']}
                                            labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                                        />
                                        <Line
                                            connectNulls={true}
                                            type="monotone"
                                            dataKey="prijs"
                                            stroke="#0ea5e9"
                                            strokeWidth={4}
                                            dot={{ stroke: '#0ea5e9', strokeWidth: 2, r: 4, fill: '#ffffff' }}
                                            activeDot={{ r: 6, fill: '#0ea5e9', stroke: '#ffffff', strokeWidth: 2 }}
                                            animationDuration={1500}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="p-8 text-center text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/30 rounded-xl">
                                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p>Onvoldoende historische data om een grafiek te tekenen (slechts 1 meetpunt).</p>
                            </div>
                        )}

                        <div className="flex justify-between text-xs text-slate-400 px-2">
                            <span>Historisch Minimum: €{minPrice.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}</span>
                            <span>Historisch Maximum: €{maxPrice.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Metadata Table and Toggle */}
            {stats?.metadata && stats.metadata.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-slate-200/50 dark:border-slate-800/50">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-bold flex items-center gap-2">
                            <FileText className="w-5 h-5 text-brand-500" />
                            Ingelezen Prijslijsten
                        </h3>
                        <button
                            onClick={() => setShowData(!showData)}
                            className={`uiverse-view-btn ${showData ? 'active' : ''}`}
                        >
                            <span>Dataset bekijken</span>
                            <ChevronDown className="icon w-4 h-4 ml-1" />
                        </button>
                    </div>

                    {showData && (
                        <div className="space-y-4 animate-in slide-in-from-top-4 fade-in duration-300">
                            {/* Filter UI */}
                            <div className="flex flex-col sm:flex-row gap-4 p-4 glass-panel rounded-xl border border-slate-200/60 dark:border-slate-800">
                                <div className="flex-1 space-y-1.5">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Merk</label>
                                    <select
                                        value={filterBrand}
                                        onChange={(e) => setFilterBrand(e.target.value)}
                                        className="w-full bg-slate-50/50 dark:bg-slate-900/50 border border-slate-300/80 dark:border-slate-700/80 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 dark:text-white transition-colors hover:bg-white dark:hover:bg-slate-900 font-medium"
                                    >
                                        <option value="">Alle Merken</option>
                                        {uniqueBrands.map((brand) => (
                                            <option key={brand} value={brand}>{brand}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="w-full sm:w-32 space-y-1.5">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Jaar</label>
                                    <select
                                        value={filterYear}
                                        onChange={(e) => setFilterYear(e.target.value)}
                                        className="w-full bg-slate-50/50 dark:bg-slate-900/50 border border-slate-300/80 dark:border-slate-700/80 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 dark:text-white transition-colors hover:bg-white dark:hover:bg-slate-900 font-medium"
                                    >
                                        <option value="">Alle Jaren</option>
                                        {uniqueYears.map((year) => (
                                            <option key={year} value={year}>{year}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex-[2] space-y-1.5">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Bestandsnaam</label>
                                    <input
                                        type="text"
                                        value={searchFile}
                                        onChange={(e) => setSearchFile(e.target.value)}
                                        placeholder="Zoek in bestandsnaam..."
                                        className="w-full bg-slate-50/50 dark:bg-slate-900/50 border border-slate-300/80 dark:border-slate-700/80 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 dark:text-white transition-colors hover:bg-white dark:hover:bg-slate-900"
                                    />
                                </div>
                                {(filterBrand || filterYear || searchFile) && (
                                    <div className="flex items-end pb-0.5 shrink-0">
                                        <button
                                            onClick={() => {
                                                setFilterBrand('');
                                                setFilterYear('');
                                                setSearchFile('');
                                            }}
                                            className="text-sm font-bold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors border border-slate-200 dark:border-slate-700 shadow-sm"
                                        >
                                            Reset Filters
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="glass-panel overflow-hidden rounded-2xl border border-slate-200/60 dark:border-slate-800">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-slate-500 uppercase tracking-wider bg-slate-100/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                                            <tr>
                                                <th className="px-6 py-4 font-bold">Merk</th>
                                                <th className="px-6 py-4 font-bold text-center">Jaar</th>
                                                <th className="px-6 py-4 font-bold">Bestandsnaam</th>
                                                <th className="px-6 py-4 font-bold text-right">Artikelen Toegevoegd</th>
                                                <th className="px-6 py-4 font-bold text-right text-slate-400">Verwerkt Op</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {filteredMetadata.length > 0 ? (
                                                filteredMetadata.map((meta: any) => (
                                                    <tr key={meta.id} className="hover:bg-white/60 dark:hover:bg-slate-800/50 transition-colors">
                                                        <td className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-100">
                                                            {normalizeBrandName(meta.manufacturer)}
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                                                {meta.year}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 font-mono text-xs text-slate-500 truncate max-w-[200px]" title={meta.fileName}>
                                                            {meta.fileName}
                                                        </td>
                                                        <td className="px-6 py-4 text-right font-medium text-emerald-600 dark:text-emerald-400">
                                                            +{meta.itemCount?.toLocaleString('nl-NL') || 0}
                                                        </td>
                                                        <td className="px-6 py-4 text-right text-xs text-slate-400 whitespace-nowrap">
                                                            {new Date(meta.addedAt).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400 font-medium">
                                                        Geen prijslijsten gevonden met de huidige filters.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                {filteredMetadata.length > 0 && filteredMetadata.length < allMetadata.length && (
                                    <div className="p-3 text-center text-xs font-medium text-slate-500 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800">
                                        Tonen van {filteredMetadata.length} van de {allMetadata.length} prijslijsten.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

        </div>
    );
}
