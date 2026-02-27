'use client';

import { useState, useEffect } from 'react';
import { Search, TrendingUp, TrendingDown, Minus, Loader2, AlertCircle, FileText } from 'lucide-react';

import { useRouter } from 'next/navigation';
import { searchArticleHistory } from '../prijslijsten-beheer/actions';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function PrijsDatabase() {
    const router = useRouter();
    const [isDeepLinked, setIsDeepLinked] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearching, setIsSearching] = useState(false);
    const [searchResult, setSearchResult] = useState<any>(null);
    const [searchError, setSearchError] = useState<string | null>(null);

    useEffect(() => {
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
                setSearchError("Product niet gevonden in de database. Zorg ervoor dat het artikelnummer precies klopt of controleer of deze al is geïmporteerd via het Database Beheer-paneel.");
            }
        } catch {
            setSearchError("Fout bij het zoeken.");
        } finally {
            setIsSearching(false);
        }
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        performSearch(searchQuery);
    };

    // Calculate chart statistics if a result exists
    const chartData = [];
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
        const maxYear = Math.max(new Date().getFullYear(), Math.max(...searchResult.history.map((h: any) => h.year)));

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

    return (
        <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in duration-700 pb-12 pt-6">

            {/* Header */}
            <div className="flex flex-col gap-2 mb-8">
                <h2 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                    <div className="p-2.5 bg-brand-500/20 text-brand-400 rounded-xl relative group">
                        <div className="absolute inset-0 bg-brand-400/20 blur-xl group-hover:bg-brand-400/40 transition-colors"></div>
                        <Search className="w-6 h-6 relative z-10" />
                    </div>
                    Database
                </h2>
                <p className="text-slate-400 text-lg">
                    Zoek naar specifieke artikelnummers om hun prijshistorie en markttrends te analyseren.
                </p>
            </div>

            {/* Search Input Area */}
            <div className="glass-panel p-6 rounded-3xl border border-white/5 relative overflow-hidden group">
                <div className="absolute -left-12 -top-12 w-48 h-48 bg-brand-500/10 rounded-full blur-3xl opacity-50"></div>
                <form onSubmit={handleSearch} className="flex gap-4 relative z-10 flex-col sm:flex-row">
                    <div className="flex-1 relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Voer een artikelnummer in (bijv. 6ES7 of 1756)..."
                            className="w-full bg-slate-900/80 border border-slate-700/50 rounded-2xl py-4 pl-12 pr-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all shadow-inner"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={isSearching || !searchQuery.trim()}
                        className="bg-brand-600 hover:bg-brand-500 text-white font-bold py-4 px-8 rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-brand-500/25 active:scale-95"
                    >
                        {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Zoeken'}
                    </button>
                </form>
            </div>

            {/* Error State */}
            {searchError && (
                <div className="flex flex-col gap-4 animate-in slide-in-from-bottom-4">
                    <div className="p-5 bg-red-950/40 text-red-400 rounded-2xl border border-red-900/50 text-sm font-medium flex gap-3 items-start">
                        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                        <p className="leading-relaxed">{searchError}</p>
                    </div>
                    {isDeepLinked && (
                        <div className="flex justify-start">
                            <button
                                onClick={() => router.back()}
                                className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-slate-300 bg-slate-800/80 hover:bg-slate-700/80 rounded-xl transition-all border border-slate-700 shadow-sm"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                                Terug naar Waardebepaling
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Results Dashboard */}
            {searchResult && (
                <div className="glass-panel p-8 rounded-[2rem] border border-white/5 animate-in slide-in-from-bottom-8 flex flex-col gap-8 shadow-xl">

                    {/* Deep link back button */}
                    {isDeepLinked && (
                        <div className="flex justify-start -mb-2">
                            <button
                                onClick={() => router.back()}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-300 bg-slate-800/50 hover:bg-slate-800 rounded-xl transition-all border border-slate-700/50"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                                Terug naar Waardebepaling
                            </button>
                        </div>
                    )}

                    {/* Fuzzy match notice */}
                    {searchResult._fuzzy_matched_key && (
                        <div className="flex items-start gap-3 p-4 bg-amber-950/30 border border-amber-900/50 rounded-2xl text-sm text-amber-400 font-medium">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <span>
                                Exact artikel niet gevonden. Dichtstbijzijnde match getoond: <span className="font-mono text-amber-300 ml-1">{searchResult._fuzzy_matched_key}</span>
                            </span>
                        </div>
                    )}

                    <div className="flex flex-col md:flex-row justify-between gap-6 pb-8 border-b border-slate-800/60 relative">
                        <div className="absolute right-0 top-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
                        <div className="relative z-10">
                            <p className="text-brand-400 text-sm font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-brand-500"></span>
                                {searchResult.manufacturer}
                            </p>
                            <h4 className="text-4xl lg:text-5xl font-extrabold text-white font-mono tracking-tight">
                                {searchResult.article_number}
                            </h4>
                        </div>

                        <div className="flex gap-4 relative z-10 flex-wrap">
                            <div className="bg-slate-900/80 px-6 py-4 rounded-2xl border border-slate-800/80 shadow-inner flex flex-col justify-center">
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-1.5 border-b border-slate-800 pb-2">Actuele Prijs</p>
                                <p className="text-3xl font-bold text-white mt-1">€{latestPrice.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}</p>
                            </div>
                            <div className="bg-slate-900/80 px-6 py-4 rounded-2xl border border-slate-800/80 shadow-inner flex flex-col justify-center">
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-1.5 border-b border-slate-800 pb-2">Gem. Prijstrend / jr</p>
                                <div className="flex items-center gap-3 mt-1">
                                    <p className={`text-2xl font-bold ${trend === 'up' ? 'text-red-400' : trend === 'down' ? 'text-emerald-400' : 'text-slate-400'}`}>
                                        {trend === 'up' ? '+' : ''}{avgChangeEur.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                                    </p>
                                    <div className={`px-2.5 py-1 rounded-full text-xs font-bold border ${trend === 'up' ? 'bg-red-950/50 text-red-400 border-red-900/50' : trend === 'down' ? 'bg-emerald-950/50 text-emerald-400 border-emerald-900/50' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                                        {trend === 'up' ? <TrendingUp size={12} className="inline mr-1" /> : trend === 'down' ? <TrendingDown size={12} className="inline mr-1" /> : <Minus size={12} className="inline mr-1" />}
                                        {avgChangePct > 0 ? '+' : ''}{avgChangePct.toFixed(1)}%
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Chart Area */}
                    {chartData.length > 1 ? (
                        <div className="mt-4">
                            <h5 className="text-sm font-bold text-slate-500 mb-6 px-2">Prijsontwikkeling door de jaren heen</h5>
                            <div className="h-[350px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" opacity={0.6} />
                                        <XAxis
                                            dataKey="year"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#64748b', fontSize: 13, fontWeight: 500 }}
                                            dy={15}
                                        />
                                        <YAxis
                                            domain={['dataMin - (dataMin * 0.05)', 'dataMax + (dataMax * 0.05)']}
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#64748b', fontSize: 13, fontWeight: 500 }}
                                            tickFormatter={(val) => `€${Math.round(val)}`}
                                            dx={-15}
                                        />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.5)', backgroundColor: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(8px)', color: '#f8fafc', fontWeight: 'bold', padding: '12px 16px' }}
                                            itemStyle={{ color: '#38bdf8', fontWeight: '800', fontSize: '1.1rem' }}
                                            formatter={(value) => [`€${Number(value).toLocaleString('nl-NL', { minimumFractionDigits: 2 })}`, 'Prijs']}
                                            labelStyle={{ color: '#94a3b8', marginBottom: '8px', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                                        />
                                        <Line
                                            connectNulls={true}
                                            type="monotone"
                                            dataKey="prijs"
                                            stroke="#0ea5e9"
                                            strokeWidth={4}
                                            dot={{ stroke: '#0ea5e9', strokeWidth: 3, r: 5, fill: '#0f172a' }}
                                            activeDot={{ r: 8, fill: '#38bdf8', stroke: '#0f172a', strokeWidth: 3 }}
                                            animationDuration={1500}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    ) : (
                        <div className="p-12 text-center text-slate-500 bg-slate-900/50 rounded-3xl border border-slate-800/50 border-dashed">
                            <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" />
                            <p className="text-lg">Onvoldoende historische data om een grafiek te tekenen.</p>
                            <p className="text-sm mt-2 opacity-60">(Slechts 1 meetpunt gevonden in het geheugen)</p>
                        </div>
                    )}

                    <div className="flex justify-between text-xs font-medium text-slate-500 px-4 py-3 bg-slate-900/50 rounded-xl border border-slate-800/50 mt-2">
                        <span>Historisch Minimum: <strong className="text-slate-300">€{minPrice.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}</strong></span>
                        <span>Historisch Maximum: <strong className="text-slate-300">€{maxPrice.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}</strong></span>
                    </div>
                </div>
            )}
        </div>
    );
}
