'use client';

import { Search, Bell, Sparkles, X, ChevronRight, Loader2, Database } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAiContextForQuestion } from '@/app/api/ai/actions';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';

function classifyIntent(query: string): 'search' | 'ai' {
    const trimmed = query.trim();
    if (!trimmed) return 'search';

    const isQuestionWord = /^(wat|hoeveel|wanneer|welke|waarom|hoe|kun)\b/i.test(trimmed);
    const hasQuestionMark = trimmed.includes('?');
    const wordCount = trimmed.split(/\s+/).length;

    if (wordCount >= 3 && (isQuestionWord || hasQuestionMark)) return 'ai';
    if (wordCount >= 5) return 'ai';

    // Explicit trigger "AI:" or "ai:"
    if (/^ai:/i.test(trimmed)) return 'ai';

    return 'search';
}

export default function TopHeader() {
    const router = useRouter();

    const [username, setUsername] = useState('Verkoper');
    const [query, setQuery] = useState('');
    const [showOverlay, setShowOverlay] = useState(false);

    // AI State
    const [aiStatus, setAiStatus] = useState<'idle' | 'context' | 'thinking' | 'streaming' | 'done' | 'error'>('idle');
    const [aiResponse, setAiResponse] = useState('');
    const [aiError, setAiError] = useState('');
    const [isAiAvailable, setIsAiAvailable] = useState(false);

    const abortController = useRef<AbortController | null>(null);

    useEffect(() => {
        // Fetch username from Electron
        const baseApi = (window as any).electronAPI;
        if (baseApi?.getUsername) {
            baseApi.getUsername().then((name: string) => {
                if (name) setUsername(name);
            });
        }

        const api = baseApi?.ai;
        if (api) {
            api.getModelStatus().then((s: any) => {
                if (s.isLoaded || s.isDownloaded) setIsAiAvailable(true);
            });
        }
    }, []);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = query.trim();
        if (!trimmed) return;

        // Strip explicit "ai:" prefix if used
        const cleanQuery = trimmed.replace(/^ai:\s*/i, '');
        const intent = classifyIntent(trimmed);

        if (intent === 'search' || !isAiAvailable) {
            // Standard search
            setShowOverlay(false);
            router.push(`/database?search=${encodeURIComponent(cleanQuery)}`);
            setQuery(''); // Clear after search
            return;
        }

        // --- AI Intent ---
        setShowOverlay(true);
        setAiStatus('context');
        setAiResponse('');
        setAiError('');

        try {
            // 1. Fetch Context via Server Action
            const context = await getAiContextForQuestion(cleanQuery);

            setAiStatus('thinking');

            // 2. Call local LLM via Electron IPC
            const api = (window as any).electronAPI?.ai;
            if (!api) throw new Error("AI bridge not available in this environment.");

            const requestId = Date.now().toString();

            // Setup listeners for this specific request
            const handleToken = (data: any) => {
                if (data.requestId === requestId) {
                    setAiStatus('streaming');
                    setAiResponse(prev => prev + data.token);
                }
            };

            const handleDone = (data: any) => {
                if (data.requestId === requestId) {
                    setAiStatus('done');
                    api.off('ai:token', handleToken);
                    api.off('ai:done', handleDone);
                    api.off('ai:error', handleError);
                }
            };

            const handleError = (data: any) => {
                if (data.requestId === requestId) {
                    setAiStatus('error');
                    setAiError(data.message);
                    api.off('ai:token', handleToken);
                    api.off('ai:done', handleDone);
                    api.off('ai:error', handleError);
                }
            };

            // Using pure IPC since we replaced preload.js to include onToken/onDone
            // We need to use the exposed methods or raw ipc if exposed.
            // Wait, in preload.js I exposed onToken, onDone, etc. which add listeners.
            // But they don't return the listener func to remove it easily. 
            // So I'll just rely on the latest state or a ref.
            // Actually, let me just use the global listener and filter by requestId.

            api.onToken(handleToken);
            api.onDone(handleDone);
            api.onError(handleError);

            api.ask(cleanQuery, context, requestId);

        } catch (err: any) {
            setAiStatus('error');
            setAiError(err.message || 'Onbekende fout tijdens AI-verwerking.');
        }
    };

    const closeOverlay = () => {
        // We could send a cancel-request to IPC here if we implemented it, 
        // but for now just hide the UI and clean up
        setShowOverlay(false);
        setQuery('');
        setAiStatus('idle');
    };

    return (
        <>
            <header className="h-24 flex items-center justify-between bg-transparent sticky top-0 z-30 shrink-0">
                <div className="flex w-full max-w-7xl mx-auto px-4 lg:px-8 items-center justify-between">
                    <div className="flex-1 max-w-2xl">
                        <form onSubmit={handleSearch} className="relative w-full group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Search className={`h-5 w-5 transition-colors ${query && classifyIntent(query) === 'ai' ? 'text-brand-400' : 'text-slate-500 group-focus-within:text-brand-400'}`} />
                            </div>
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Zoeken (gebruik 'Wat kost...' voor AI)"
                                className={`w-full bg-slate-900/50 text-white placeholder-slate-500 rounded-2xl py-3.5 pl-12 pr-4 border transition-all shadow-inner shadow-black/20 focus:outline-none focus:ring-2 ${query && classifyIntent(query) === 'ai'
                                    ? 'border-brand-500/50 focus:ring-brand-500/50 bg-brand-900/10'
                                    : 'border-slate-800/50 focus:ring-brand-500/50'
                                    }`}
                                suppressHydrationWarning
                            />
                            {query && classifyIntent(query) === 'ai' && (
                                <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                                    <Sparkles className="h-4 w-4 text-brand-400 animate-pulse" />
                                </div>
                            )}
                        </form>
                    </div>

                    <div className="flex items-center gap-6 shrink-0 ml-4">
                        <button className="text-slate-400 hover:text-white relative transition-all hover:scale-110 active:scale-95 bg-slate-900 p-2.5 rounded-full border border-slate-800 focus:outline-none">
                            <Bell size={20} />
                            <span className="absolute top-2 right-2.5 w-2 h-2 bg-brand-500 rounded-full border-2 border-slate-900"></span>
                        </button>
                        <div className="flex items-center gap-3 pl-6 border-l border-white/5">
                            <span className="text-sm font-bold text-slate-200 tracking-wide" suppressHydrationWarning>{username}</span>
                        </div>
                    </div>
                </div>
            </header>

            {/* AI Spotlight Overlay */}
            {showOverlay && (
                <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl shadow-black/50 w-full max-w-3xl overflow-hidden flex flex-col max-h-[80vh] animate-in slide-in-from-top-8 duration-300">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/20">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-brand-500/10 rounded-lg border border-brand-500/20">
                                    <Sparkles className="h-5 w-5 text-brand-400" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-200">AI-Assistent</h3>
                                    <p className="text-xs text-slate-400">Offline geanalyseerd ({query})</p>
                                </div>
                            </div>
                            <button onClick={closeOverlay} className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-full transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Content Body */}
                        <div className="p-6 overflow-y-auto flex-1 text-slate-300 text-sm leading-relaxed">
                            {aiStatus === 'context' && (
                                <div className="flex items-center justify-center py-12 text-slate-500 flex-col gap-4 animate-pulse">
                                    <Database className="h-8 w-8 text-slate-600" />
                                    <p>Database doorzoeken naar relevante prijshistorie...</p>
                                </div>
                            )}

                            {aiStatus === 'thinking' && (
                                <div className="flex items-center justify-center py-12 text-slate-500 flex-col gap-4 animate-pulse">
                                    <Loader2 className="h-8 w-8 text-brand-500/50 animate-spin" />
                                    <p>AI formuleert een antwoord...</p>
                                </div>
                            )}

                            {(aiStatus === 'streaming' || aiStatus === 'done') && (
                                <div className="prose prose-invert prose-brand max-w-none">
                                    <ReactMarkdown>{aiResponse}</ReactMarkdown>
                                    {aiStatus === 'streaming' && (
                                        <span className="inline-block w-2 h-4 ml-1 bg-brand-400 animate-pulse relative top-1"></span>
                                    )}
                                </div>
                            )}

                            {aiStatus === 'error' && (
                                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
                                    <p className="font-semibold flex items-center gap-2">
                                        <X size={16} /> Fout bij genereren
                                    </p>
                                    <p className="mt-1 text-sm opacity-80">{aiError}</p>
                                </div>
                            )}
                        </div>

                        {/* Footer Action */}
                        {(aiStatus === 'done' || aiStatus === 'streaming') && (
                            <div className="p-4 bg-slate-900 border-t border-slate-800 flex justify-end">
                                <button
                                    onClick={() => {
                                        closeOverlay();
                                        router.push(`/database?search=${encodeURIComponent(query.replace(/^ai:\s*/i, ''))}`);
                                    }}
                                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors text-sm font-medium border border-slate-700 hover:border-slate-600"
                                >
                                    Bekijk in Database <ChevronRight size={16} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
