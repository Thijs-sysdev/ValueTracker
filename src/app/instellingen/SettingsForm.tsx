'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateDataDir, updatePriceListsDir } from './actions';
import { reanalyzePriceListsAction } from '../prijslijsten-beheer/actions';
import { RefreshCw, Save, Info, HardDrive, Database } from 'lucide-react';

interface Props {
    currentDataDir: string;
    currentPriceListsDir: string;
    settingsFile: string;
    isDefault: boolean;
}

export default function SettingsForm({ currentDataDir, currentPriceListsDir, settingsFile, isDefault }: Props) {
    const [inputValue, setInputValue] = useState(currentDataDir);
    const [priceListsInputValue, setPriceListsInputValue] = useState(currentPriceListsDir);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [priceListsMessage, setPriceListsMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [reanalyzeMessage, setReanalyzeMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [isPending, startTransition] = useTransition();
    const [isReanalyzing, startReanalyzeTransition] = useTransition();
    const router = useRouter();

    const handleSave = () => {
        startTransition(async () => {
            const result = await updateDataDir(inputValue);
            if (result.success) {
                setMessage({ type: 'success', text: '✅ Opgeslagen! De nieuwe map is direct actief.' });
                router.refresh();
            } else {
                setMessage({ type: 'error', text: `❌ ${result.error}` });
            }
        });
    };

    const handleSavePriceListsDir = () => {
        startTransition(async () => {
            const result = await updatePriceListsDir(priceListsInputValue);
            if (result.success) {
                setPriceListsMessage({ type: 'success', text: '✅ Opgeslagen! De nieuwe map is ingesteld.' });
                router.refresh();
            } else {
                setPriceListsMessage({ type: 'error', text: `❌ ${result.error}` });
            }
        });
    };

    const handleReanalyze = () => {
        startReanalyzeTransition(async () => {
            setReanalyzeMessage(null);
            const result = await reanalyzePriceListsAction();
            if (result.success) {
                setReanalyzeMessage({ type: 'success', text: result.message || 'Succesvol her-geanalyseerd!' });
                router.refresh();
            } else {
                setReanalyzeMessage({ type: 'error', text: `❌ ${result.error}` });
            }
        });
    };

    return (
        <div className="settings-form">
            <div className="settings-field">
                <label htmlFor="dataDir">
                    <Database className="w-3.5 h-3.5 inline mr-2 text-brand-400" />
                    Data map pad
                </label>
                <div className="settings-input-row">
                    <input
                        id="dataDir"
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Bijv. C:\Users\...\OneDrive\ValueTracker"
                        className="settings-input"
                    />
                    <button
                        onClick={handleSave}
                        disabled={isPending}
                        className="btn-primary gap-2"
                    >
                        {isPending ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        {isPending ? 'Opslaan...' : 'Opslaan'}
                    </button>
                </div>
                <div className="settings-hint">
                    <Info className="w-4 h-4 text-slate-500 shrink-0" />
                    <span>
                        Voer het volledige pad in naar de map met <code>config.json</code>, <code>history.json</code> en <code>price_db.json</code>.
                    </span>
                </div>
            </div>

            {message && (
                <div className={`settings-message ${message.type}`}>
                    {message.text}
                </div>
            )}

            <hr className="settings-divider" />

            <div className="settings-field">
                <label htmlFor="priceListsDir">
                    <HardDrive className="w-3.5 h-3.5 inline mr-2 text-brand-400" />
                    Ingelezen Prijslijsten map pad
                </label>
                <div className="settings-input-row">
                    <input
                        id="priceListsDir"
                        type="text"
                        value={priceListsInputValue}
                        onChange={(e) => setPriceListsInputValue(e.target.value)}
                        placeholder="Bijv. C:\Users\...\OneDrive\uploaded pricelists"
                        className="settings-input"
                    />
                    <button
                        onClick={handleSavePriceListsDir}
                        disabled={isPending}
                        className="btn-primary gap-2"
                    >
                        {isPending ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        {isPending ? 'Opslaan...' : 'Opslaan'}
                    </button>
                </div>
                <div className="settings-hint">
                    <Info className="w-4 h-4 text-slate-500 shrink-0" />
                    <span>
                        Voer het volledige pad in naar de OneDrive map waar prijslijsten bewaard moeten worden.
                    </span>
                </div>
            </div>

            {priceListsMessage && (
                <div className={`settings-message ${priceListsMessage.type}`}>
                    {priceListsMessage.text}
                </div>
            )}

            <hr className="settings-divider" />

            <div className="settings-meta">
                <h3>Huidige configuratie</h3>
                <table className="settings-table">
                    <tbody>
                        <tr>
                            <td>Actieve data map:</td>
                            <td><code>{currentDataDir}</code></td>
                        </tr>
                        <tr>
                            <td>Instelling opgeslagen in:</td>
                            <td><code>{settingsFile}</code></td>
                        </tr>
                        <tr>
                            <td>Ingelezen prijslijsten map:</td>
                            <td className="flex items-center gap-2">
                                <code>{currentPriceListsDir}</code>
                                <button
                                    onClick={handleReanalyze}
                                    disabled={isReanalyzing}
                                    className="p-1.5 rounded-md bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                                    title="Re-analyseer alle bestanden in deze map"
                                >
                                    <RefreshCw className={`w-4 h-4 ${isReanalyzing ? 'animate-spin text-brand-400' : ''}`} />
                                </button>
                            </td>
                        </tr>
                        {reanalyzeMessage && (
                            <tr>
                                <td colSpan={2} className={`text-sm ${reanalyzeMessage.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {reanalyzeMessage.text}
                                </td>
                            </tr>
                        )}
                        <tr>
                            <td>Status:</td>
                            <td>
                                {isDefault
                                    ? <span className="badge badge-default">Standaard (lokaal)</span>
                                    : <span className="badge badge-custom">Aangepast pad</span>
                                }
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}
