'use client';

import { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Rocket, Download, CheckCircle2, AlertCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { motion, AnimatePresence } from 'framer-motion';

interface UpdateInfo {
    version?: string;
    percent?: number;
    message?: string;
}

type UpdateState =
    | 'idle'
    | 'checking'
    | 'available'
    | 'downloading'
    | 'downloaded'
    | 'error';

/**
 * UpdateBanner
 *
 * Only renders inside Electron (window.electronUpdater is injected by preload.js).
 * In the browser (Vercel / dev), this component is completely invisible.
 */
export default function UpdateBanner() {
    const [state, setState] = useState<UpdateState>('idle');
    const [info, setInfo] = useState<UpdateInfo>({});

    useEffect(() => {
        // Not running in Electron — do nothing
        if (typeof window === 'undefined' || !(window as any).electronUpdater) return;

        const updater = (window as any).electronUpdater;

        updater.on('updater:checking', () => setState('checking'));

        updater.on('updater:available', (data: UpdateInfo) => {
            setState('available');
            setInfo(data);
        });

        updater.on('updater:not-available', () => setState('idle'));

        updater.on('updater:progress', (data: UpdateInfo) => {
            setState('downloading');
            setInfo(data);
        });

        updater.on('updater:downloaded', (data: UpdateInfo) => {
            setState('downloaded');
            setInfo(data);
        });

        updater.on('updater:error', (data: UpdateInfo) => {
            setState('error');
            setInfo(data);
        });
    }, []);

    return (
        <AnimatePresence>
            {state !== 'idle' && state !== 'checking' && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="fixed bottom-4 right-4 z-[9999] w-full max-w-md"
                >
                    {state === 'available' && (
                        <Alert className="border-primary/20 bg-background/95 backdrop-blur shadow-2xl">
                            <Rocket className="h-4 w-4 text-primary" />
                            <AlertTitle className="font-semibold flex items-center gap-2">
                                Update Beschikbaar <Badge variant="secondary">v{info.version}</Badge>
                            </AlertTitle>
                            <AlertDescription className="mt-2 flex items-center justify-between">
                                <span className="text-muted-foreground text-sm">Wordt gedownload in achtergrond...</span>
                                <Button variant="outline" size="sm" onClick={() => (window as any).electronUpdater?.openReleases()}>
                                    Wat is nieuw?
                                </Button>
                            </AlertDescription>
                        </Alert>
                    )}

                    {state === 'downloading' && (
                        <Alert className="border-primary/20 bg-background/95 backdrop-blur shadow-2xl">
                            <Download className="h-4 w-4 text-primary animate-bounce" />
                            <AlertTitle className="font-semibold">Update wordt gedownload...</AlertTitle>
                            <AlertDescription className="mt-3 flex flex-col gap-2">
                                <Progress value={info.percent ?? 0} className="h-2" />
                                <span className="text-xs text-muted-foreground text-right">{Math.round(info.percent ?? 0)}%</span>
                            </AlertDescription>
                        </Alert>
                    )}

                    {state === 'downloaded' && (
                        <Alert className="border-green-500/50 bg-green-500/10 backdrop-blur shadow-2xl text-green-50 dark:text-green-400">
                            <CheckCircle2 className="h-4 w-4 !text-green-500" />
                            <AlertTitle className="font-semibold text-green-700 dark:text-green-300 flex items-center gap-2">
                                Update Klaar <Badge variant="outline" className="border-green-500/30 text-green-600 dark:text-green-300">v{info.version}</Badge>
                            </AlertTitle>
                            <AlertDescription className="mt-3 flex items-center gap-2">
                                <Button
                                    className="bg-green-600 hover:bg-green-700 text-white"
                                    size="sm"
                                    onClick={() => (window as any).electronUpdater?.installNow()}
                                >
                                    Herstart & Installeer
                                </Button>
                                <Button
                                    variant="ghost"
                                    className="hover:bg-green-500/20 text-green-700 dark:text-green-300"
                                    size="sm"
                                    onClick={() => setState('idle')}
                                >
                                    Later
                                </Button>
                            </AlertDescription>
                        </Alert>
                    )}

                    {state === 'error' && (
                        <Alert variant="destructive" className="bg-destructive/10 backdrop-blur shadow-2xl border-destructive/20 text-destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle className="font-semibold">Update Mislukt</AlertTitle>
                            <AlertDescription className="mt-2 flex items-center justify-between">
                                <span className="text-sm opacity-80">Controleer je verbinding.</span>
                                <Button variant="outline" size="sm" onClick={() => setState('idle')} className="hover:bg-destructive/20 border-destructive/30 text-destructive">
                                    Sluiten
                                </Button>
                            </AlertDescription>
                        </Alert>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
}
