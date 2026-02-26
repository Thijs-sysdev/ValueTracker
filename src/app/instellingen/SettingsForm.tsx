'use client';

import { useState, useTransition } from 'react';
import { updateDataDir, resetDataDir } from './actions';
import Link from 'next/link';

interface Props {
    currentDataDir: string;
    settingsFile: string;
    isDefault: boolean;
}

export default function SettingsForm({ currentDataDir, settingsFile, isDefault }: Props) {
    const [inputValue, setInputValue] = useState(currentDataDir);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [isPending, startTransition] = useTransition();
    const [showTip, setShowTip] = useState(false);

    const handleSave = () => {
        startTransition(async () => {
            const result = await updateDataDir(inputValue);
            if (result.success) {
                setMessage({ type: 'success', text: '✅ Opgeslagen! De nieuwe map is direct actief.' });
            } else {
                setMessage({ type: 'error', text: `❌ ${result.error}` });
            }
        });
    };

    const handleReset = () => {
        startTransition(async () => {
            const result = await resetDataDir();
            if (result.success) {
                setInputValue('');
                setMessage({ type: 'success', text: '✅ Teruggezet naar standaard (./data/).' });
            }
        });
    };

    return (
        <div className="settings-form">
            <div className="settings-field">
                <label htmlFor="dataDir">Data map pad</label>
                <div className="settings-input-row">
                    <input
                        id="dataDir"
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Bijv. C:\Users\...\OneDrive - Parttracker BV\Apps\ValueTracker"
                        className="settings-input"
                    />
                    <button
                        onClick={handleSave}
                        disabled={isPending}
                        className="btn-primary"
                    >
                        {isPending ? 'Opslaan...' : 'Opslaan'}
                    </button>
                </div>
                <p className="settings-hint">
                    Voer het volledige pad in naar de map met <code>config.json</code>, <code>history.json</code> en <code>price_db.json</code>.
                </p>
            </div>

            {message && (
                <div className={`settings-message ${message.type}`}>
                    {message.text}
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

            {!isDefault && (
                <button
                    onClick={handleReset}
                    disabled={isPending}
                    className="btn-danger"
                >
                    Terugzetten naar standaard (./data/)
                </button>
            )}

            <button
                onClick={() => setShowTip(v => !v)}
                className="settings-tip-toggle"
            >
                💡 OneDrive instelling (werk-pc) {showTip ? '▲' : '▼'}
            </button>

            {showTip && (
                <div className="settings-info-box">
                    <p>Stel dit pad in op je werk-pc:</p>
                    <code>C:\Users\ThijsRosmalen\OneDrive - Parttracker BV\Apps\ValueTracker</code>
                    <p style={{ marginTop: '0.5rem' }}>
                        Zorg dat je collega&apos;s toegang hebben tot dezelfde OneDrive map.
                        Iedereen die de app opent wijst naar dezelfde bestanden.
                    </p>
                </div>
            )}
        </div>
    );
}
