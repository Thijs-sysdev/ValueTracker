'use client';

import { useEffect, useState } from 'react';

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

    if (state === 'idle' || state === 'checking') return null;

    return (
        <div className="update-banner" data-state={state}>
            {state === 'available' && (
                <>
                    <span>🚀 Versie {info.version} beschikbaar — wordt op achtergrond gedownload</span>
                    <button onClick={() => (window as any).electronUpdater?.openReleases()} className="update-btn-ghost">
                        Wat is er nieuw?
                    </button>
                </>
            )}

            {state === 'downloading' && (
                <>
                    <span>⬇️ Update downloaden… {Math.round(info.percent ?? 0)}%</span>
                    <div className="update-progress-bar">
                        <div
                            className="update-progress-fill"
                            style={{ width: `${info.percent ?? 0}%` }}
                        />
                    </div>
                </>
            )}

            {state === 'downloaded' && (
                <>
                    <span>✅ Versie {info.version} klaar om te installeren</span>
                    <button
                        onClick={() => (window as any).electronUpdater?.installNow()}
                        className="update-btn-primary"
                    >
                        Nu herstarten &amp; installeren
                    </button>
                    <button onClick={() => setState('idle')} className="update-btn-ghost">
                        Later
                    </button>
                </>
            )}

            {state === 'error' && (
                <>
                    <span>⚠️ Update mislukt — controleer je internetverbinding</span>
                    <button onClick={() => setState('idle')} className="update-btn-ghost">
                        Sluiten
                    </button>
                </>
            )}
        </div>
    );
}
