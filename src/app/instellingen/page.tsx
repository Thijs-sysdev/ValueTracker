import { getDataDirSettings } from './actions';
import SettingsForm from './SettingsForm';
import { getConfigMatrix } from '@/lib/config';
import ConfigForm from '../configuratie/ConfigForm';
import ConfigTable from '../configuratie/ConfigTable';
import { Settings, Database, Calculator } from 'lucide-react';

export const metadata = {
    title: 'Instellingen | ValueTracker',
    description: 'Configureer de data map en rekenregels.',
};

export const dynamic = 'force-dynamic';

export default async function InstellingenPage() {
    const settings = await getDataDirSettings();
    const configMatrix = await getConfigMatrix();
    const configList = Object.values(configMatrix);

    return (
        <main className="max-w-5xl mx-auto space-y-10 animate-in fade-in duration-700 pb-12 pt-6">
            <div className="flex flex-col gap-2 mb-8">
                <h2 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                    <div className="p-2.5 bg-brand-500/20 text-brand-400 rounded-xl relative group">
                        <div className="absolute inset-0 bg-brand-400/20 blur-xl group-hover:bg-brand-400/40 transition-colors"></div>
                        <Settings className="w-6 h-6 relative z-10" />
                    </div>
                    Instellingen & Configuratie
                </h2>
                <p className="text-slate-400 text-lg">
                    Algemene instellingen voor dataopslag en de rekenregels voor de waardebepaling.
                </p>
            </div>

            <div className="space-y-6">
                <details className="group glass-panel rounded-3xl border border-white/5 overflow-hidden [&_summary::-webkit-details-marker]:hidden">
                    <summary className="flex items-center justify-between p-6 cursor-pointer select-none">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl">
                                <Database className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">Data Map Opslag</h3>
                                <p className="text-slate-400 text-sm mt-1">Wijzig de locatie waar ValueTracker data opslaat.</p>
                            </div>
                        </div>
                        <div className="text-slate-500 group-open:-rotate-180 transition-transform duration-300">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                    </summary>
                    <div className="p-6 pt-0 border-t border-white/5">
                        <div className="mt-6">
                            <SettingsForm currentDataDir={settings.currentDataDir} settingsFile={settings.settingsFile} isDefault={settings.isDefault} />
                        </div>
                    </div>
                </details>

                <details className="group glass-panel rounded-3xl border border-white/5 overflow-hidden [&_summary::-webkit-details-marker]:hidden" open>
                    <summary className="flex items-center justify-between p-6 cursor-pointer select-none">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
                                <Calculator className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">Configuratie Rekenregels</h3>
                                <p className="text-slate-400 text-sm mt-1">Beheer de rekenformules per merk en categorie.</p>
                            </div>
                        </div>
                        <div className="text-slate-500 group-open:-rotate-180 transition-transform duration-300">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                    </summary>
                    <div className="p-6 pt-0 border-t border-white/5">
                        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-1">
                                <ConfigForm />
                            </div>
                            <div className="lg:col-span-2">
                                <ConfigTable configs={configList} />
                            </div>
                        </div>
                    </div>
                </details>
            </div>
        </main>
    );
}
