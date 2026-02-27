'use client';

import { Search, Bell, BrainCircuit, Loader2 } from 'lucide-react';
import os from 'os';
import { useEffect, useState } from 'react';

type AiStatus = 'unavailable' | 'not-downloaded' | 'downloading' | 'ready';

export default function TopHeader() {
    const username = os.userInfo().username || 'Verkoper';

    const [aiStatus, setAiStatus] = useState<AiStatus>('unavailable');
    const [downloadProgress, setDownloadProgress] = useState<{ percent: number; receivedMB: string; totalMB: string } | null>(null);

    useEffect(() => {
        const api = (window as any).electronAPI?.ai;
        if (!api) return; // Running in browser/dev without Electron

        // Check initial model status
        api.getModelStatus().then((status: any) => {
            if (status.isLoaded || status.isDownloaded) {
                setAiStatus('ready');
            } else if (status.isDownloading) {
                setAiStatus('downloading');
            } else {
                setAiStatus('not-downloaded');
            }
        });

        // Listen for download progress
        api.onDownloadProgress((progress: any) => {
            setAiStatus('downloading');
            setDownloadProgress(progress);
        });

        api.onDownloadDone(() => {
            setAiStatus('ready');
            setDownloadProgress(null);
        });

        api.onDownloadError(() => {
            setAiStatus('not-downloaded');
            setDownloadProgress(null);
        });

        return () => {
            api.removeAllListeners?.();
        };
    }, []);

    const aiBadge = () => {
        if (aiStatus === 'unavailable') return null;

        if (aiStatus === 'downloading') {
            return (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold" title={`AI model downloaden... ${downloadProgress?.percent ?? 0}% (${downloadProgress?.receivedMB ?? 0}/${downloadProgress?.totalMB ?? '?'} MB)`}>
                    <Loader2 size={12} className="animate-spin" />
                    <span className="hidden sm:inline">AI {downloadProgress?.percent ?? 0}%</span>
                </div>
            );
        }

        if (aiStatus === 'not-downloaded') {
            return (
                <button
                    onClick={() => (window as any).electronAPI?.ai?.downloadModel()}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-xs font-bold hover:border-brand-500/50 hover:text-brand-400 transition-all"
                    title="Klik om de AI-assistent te activeren (eenmalige download ~1.8GB)"
                >
                    <BrainCircuit size={12} />
                    <span className="hidden sm:inline">AI activeren</span>
                </button>
            );
        }

        if (aiStatus === 'ready') {
            return (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-bold" title="AI-assistent actief">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
                    <span className="hidden sm:inline">AI actief</span>
                </div>
            );
        }

        return null;
    };

    return (
        <header className="h-24 flex items-center justify-between bg-transparent sticky top-0 z-30 shrink-0">
            <div className="flex w-full max-w-7xl mx-auto px-4 lg:px-8 items-center justify-between">
                <div className="flex-1 max-w-2xl">
                    <div className="relative w-full group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-slate-500 group-focus-within:text-brand-400 transition-colors" />
                        </div>
                        <input
                            type="text"
                            placeholder="Zoeken of stel een vraag aan de AI..."
                            className="w-full bg-slate-900/50 text-white placeholder-slate-500 rounded-2xl py-3.5 pl-12 pr-4 border border-slate-800/50 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-transparent transition-all shadow-inner shadow-black/20"
                            suppressHydrationWarning
                        />
                    </div>
                </div>

                <div className="flex items-center gap-4 shrink-0 ml-4">
                    {aiBadge()}
                    <button className="text-slate-400 hover:text-white relative transition-all hover:scale-110 active:scale-95 bg-slate-900 p-2.5 rounded-full border border-slate-800 focus:outline-none">
                        <Bell size={20} />
                        <span className="absolute top-2 right-2.5 w-2 h-2 bg-brand-500 rounded-full border-2 border-slate-900"></span>
                    </button>
                    <div className="flex items-center gap-3 pl-6 border-l border-white/5">
                        <span className="text-sm font-bold text-slate-200 tracking-wide">{username}</span>
                    </div>
                </div>
            </div>
        </header>
    );
}
