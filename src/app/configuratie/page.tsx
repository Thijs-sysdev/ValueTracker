import { getConfigMatrix } from '@/lib/config';
import Link from 'next/link';
import { Settings, ArrowLeft } from 'lucide-react';
import ConfigForm from './ConfigForm';
import ConfigTable from './ConfigTable';

export const dynamic = 'force-dynamic';

export default async function ConfigPage() {
    const configMatrix = await getConfigMatrix();
    const configList = Object.values(configMatrix);

    return (
        <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in duration-700 pb-12 pt-6 px-4 md:px-0">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <Link href="/" className="text-slate-400 hover:text-brand-500 transition-colors">
                            <ArrowLeft size={24} />
                        </Link>
                        <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                            <Settings className="text-brand-500" />
                            Configuratie
                        </h2>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 max-w-2xl">
                        Beheer de waardebepalingsformules per merk en categorie. Als een combinatie niet bestaat, wordt deze afgewezen bij de berekening.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                    <ConfigForm />
                </div>
                <div className="lg:col-span-2">
                    <ConfigTable configs={configList} />
                </div>
            </div>
        </div>
    );
}
