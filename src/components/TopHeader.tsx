'use client';

import { Search, Bell, Sparkles, X, ChevronRight, Loader2, Database } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAiContextForQuestion } from '@/app/api/ai/actions';
import { AggregationResult } from '@/lib/ai/aggregator';
import AiPriceChart from '@/components/AiPriceChart';
import ReactMarkdown from 'react-markdown';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';

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
    const [matchedCodes, setMatchedCodes] = useState<string[]>([]);
    const [chartData, setChartData] = useState<AggregationResult | undefined>(undefined);


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
        setChartData(undefined);

        try {
            // 1. Fetch Context via Server Action (also runs Detective AI + RAG in parallel)
            const { contextString: context, matchedCodes: extractedCodes, chartData: detectedChart } = await getAiContextForQuestion(cleanQuery);
            setMatchedCodes(extractedCodes);
            if (detectedChart) setChartData(detectedChart);

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
        setShowOverlay(false);
        setQuery('');
        setAiStatus('idle');
        setChartData(undefined);
    };

    return (
        <TooltipProvider delayDuration={150}>
            <header className="h-24 flex items-center justify-between bg-transparent sticky top-0 z-30 shrink-0">
                <div className="flex w-full max-w-7xl mx-auto px-4 lg:px-8 items-center justify-between">
                    <div className="flex-1 max-w-2xl">
                        <form onSubmit={handleSearch} className="relative w-full group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Search className={`h-4 w-4 transition-colors ${query && classifyIntent(query) === 'ai' ? 'text-primary' : 'text-muted-foreground group-focus-within:text-primary'}`} />
                            </div>
                            <Input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Zoeken in database (of gebruik 'Wat kost...' voor AI)"
                                className={`w-full bg-muted/50 pl-11 pr-10 h-11 rounded-full border-border shadow-inner transition-all ${query && classifyIntent(query) === 'ai'
                                    ? 'border-primary focus-visible:ring-primary/50'
                                    : 'focus-visible:ring-primary/30'
                                    }`}
                                suppressHydrationWarning
                            />
                            {query && classifyIntent(query) === 'ai' && (
                                <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                                    <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                                </div>
                            )}
                        </form>
                    </div>

                    <div className="flex items-center gap-4 shrink-0 ml-4">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="relative rounded-full h-10 w-10 text-muted-foreground hover:text-foreground">
                                    <Bell size={20} />
                                    <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full border-2 border-background"></span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Meldingen</TooltipContent>
                        </Tooltip>

                        <div className="flex items-center gap-3 pl-4 border-l border-border">
                            <Avatar className="h-9 w-9 border border-border bg-secondary flex items-center justify-center text-primary font-bold">
                                <AvatarFallback className="bg-transparent">{username.substring(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                                <span className="text-sm font-semibold text-foreground leading-none" suppressHydrationWarning>{username}</span>
                                <span className="text-[10px] text-muted-foreground">Medewerker</span>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* AI Spotlight Overlay */}
            {showOverlay && (
                <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[80vh] animate-in slide-in-from-top-8 duration-300">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/30">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-lg border border-primary/20">
                                    <Sparkles className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-foreground">AI-Verkenning</h3>
                                    <p className="text-xs text-muted-foreground">Datapunt geanalyseerd: <span className="italic">&quot;{query}&quot;</span></p>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={closeOverlay} className="rounded-full text-muted-foreground">
                                <X size={20} />
                            </Button>
                        </div>

                        {/* Content Body */}
                        <div className="p-6 overflow-y-auto flex-1 text-card-foreground text-sm leading-relaxed">
                            {aiStatus === 'context' && (
                                <div className="flex items-center justify-center py-12 text-muted-foreground flex-col gap-4">
                                    <Database className="h-8 w-8 text-primary/40 animate-pulse" />
                                    <p className="font-medium">Kennisbank & prijsdatabase doorzoeken...</p>
                                    <div className="space-y-2 mt-4 w-full max-w-sm flex flex-col gap-2">
                                        <Skeleton className="h-4 w-full" />
                                        <Skeleton className="h-4 w-[90%]" />
                                        <Skeleton className="h-4 w-[60%]" />
                                    </div>
                                </div>
                            )}


                            {aiStatus === 'thinking' && (
                                <div className="flex items-center justify-center py-12 text-muted-foreground flex-col gap-4">
                                    <Loader2 className="h-8 w-8 text-primary animate-spin" />
                                    <p className="font-medium animate-pulse">AI formuleert een antwoord...</p>
                                    <div className="space-y-4 mt-6 w-full max-w-md">
                                        <Skeleton className="h-4 w-full" />
                                        <Skeleton className="h-4 w-full delay-150" />
                                        <Skeleton className="h-4 w-[85%] delay-300" />
                                    </div>
                                </div>
                            )}

                            {(aiStatus === 'streaming' || aiStatus === 'done') && (
                                <div className="prose prose-invert max-w-none prose-p:leading-relaxed prose-headings:text-foreground prose-table:border-collapse prose-table:w-full prose-th:border prose-th:border-border prose-th:p-2 prose-td:border prose-td:border-border prose-td:p-2 prose-th:bg-muted/50">
                                    <ReactMarkdown>{aiResponse}</ReactMarkdown>
                                    {aiStatus === 'streaming' && (
                                        <span className="inline-block w-2 h-4 ml-1 bg-primary animate-pulse relative top-1"></span>
                                    )}
                                    {/* Chart — rendered below LLM response when Detective AI found trend data */}
                                    {chartData && aiStatus === 'done' && (
                                        <AiPriceChart
                                            manufacturer={chartData.manufacturer}
                                            yearlyData={chartData.yearlyData}
                                            totalArticles={chartData.totalArticles}
                                        />
                                    )}
                                </div>
                            )}

                            {aiStatus === 'error' && (
                                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive">
                                    <p className="font-semibold flex items-center gap-2">
                                        <X size={16} /> Fout bij genereren
                                    </p>
                                    <p className="mt-1 text-sm opacity-80">{aiError}</p>
                                </div>
                            )}
                        </div>

                        {/* Footer Action */}
                        {(aiStatus === 'done' || aiStatus === 'streaming') && (
                            <div className="p-4 bg-muted/20 border-t border-border flex justify-end">
                                <Button
                                    onClick={() => {
                                        closeOverlay();
                                        const searchQuery = matchedCodes.length > 0 ? matchedCodes[0] : query.replace(/^ai:\s*/i, '');
                                        router.push(`/database?search=${encodeURIComponent(searchQuery)}`);
                                    }}
                                >
                                    Bekijk in Database
                                    <ChevronRight className="ml-2 h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </TooltipProvider>
    );
}
