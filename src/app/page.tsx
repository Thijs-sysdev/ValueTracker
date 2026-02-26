'use client';

import { Activity, Database, Scale, History, HelpCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getDatabaseStats } from './beheer/actions';

export default function Dashboard() {
    const [stats, setStats] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchStats() {
            setIsLoading(true);
            const cachedStats = sessionStorage.getItem('db_stats');
            if (cachedStats) {
                setStats(JSON.parse(cachedStats));
                setIsLoading(false);
                return;
            }
            const res = await getDatabaseStats();
            if (res.success) {
                setStats(res);
                sessionStorage.setItem('db_stats', JSON.stringify(res));
            }
            setIsLoading(false);
        }
        fetchStats();
    }, []);

    const features = [
        {
            title: 'Waardebepaling',
            description: 'Taxeer en bereken inkoopprijzen voor artikelen.',
            icon: <Scale className="w-8 h-8 text-brand-400" />,
            href: '/waardebepaling',
            color: 'bg-brand-500/10 border-brand-500/20 hover:border-brand-500/50',
        },
        {
            title: 'Prijs Database',
            description: 'Zoek in de actuele prijshistorie van alle ingelezen artikelen.',
            icon: <History className="w-8 h-8 text-blue-400" />,
            href: '/prijs-database',
            color: 'bg-blue-500/10 border-blue-500/20 hover:border-blue-500/50',
        },
        {
            title: 'Database Beheer',
            description: 'Upload en beheer prijslijsten van leveranciers.',
            icon: <Database className="w-8 h-8 text-emerald-400" />,
            href: '/beheer',
            color: 'bg-emerald-500/10 border-emerald-500/20 hover:border-emerald-500/50',
        }
    ];

    return (
        <div className="max-w-5xl mx-auto space-y-10 animate-in fade-in duration-700 pb-12 pt-4">

            {/* Welcome Section */}
            <div className="relative overflow-hidden glass-panel p-8 sm:p-10 rounded-[2.5rem] border border-white/5">
                <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/10 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/3"></div>
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none translate-y-1/2 -translate-x-1/3"></div>

                <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start md:items-center justify-between">
                    <div className="max-w-xl">
                        <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight mb-4">
                            Welkom bij <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-blue-500">ValueTracker</span>
                        </h1>
                        <p className="text-lg text-slate-400 leading-relaxed">
                            Het centrale portaal voor de waardebepaling, prijsanalyse en beheer van industriële componenten.
                        </p>
                    </div>

                    <div className="glass-panel border border-white/5 p-6 rounded-3xl bg-slate-900/50 shrink-0 w-full md:w-auto">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 bg-brand-500/20 rounded-xl text-brand-400">
                                <Activity className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Systeemstatus</p>
                                <p className="text-white font-medium flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                    Online & Actief
                                </p>
                            </div>
                        </div>
                        <div className="pt-4 border-t border-slate-800">
                            <p className="text-sm text-slate-400 mb-1">Artikelen in Geheugen:</p>
                            {isLoading ? (
                                <div className="h-8 w-24 bg-slate-800 rounded animate-pulse"></div>
                            ) : (
                                <p className="text-3xl font-extrabold font-mono text-white tracking-tight">
                                    {stats?.totalItems?.toLocaleString('nl-NL') || 0}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Actions Grid */}
            <div>
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                    Sneltoetsen
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {features.map((feature) => (
                        <Link
                            key={feature.href}
                            href={feature.href}
                            className={`group relative overflow-hidden glass-panel p-8 rounded-3xl border transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-brand-500/10 ${feature.color}`}
                        >
                            <div className="absolute top-0 right-0 p-8 transform translate-x-4 -translate-y-4 opacity-10 group-hover:scale-150 group-hover:opacity-20 transition-all duration-700">
                                {feature.icon}
                            </div>
                            <div className="relative z-10 flex flex-col h-full">
                                <div className="mb-6">
                                    {feature.icon}
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-brand-300 transition-colors">
                                    {feature.title}
                                </h3>
                                <p className="text-slate-400 text-sm leading-relaxed flex-1">
                                    {feature.description}
                                </p>
                                <div className="mt-6 flex items-center text-sm font-bold text-white/50 group-hover:text-white transition-colors">
                                    Open Module
                                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>

            {/* Help & Support Banner */}
            <Link href="/help" className="block w-full">
                <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/5 bg-gradient-to-r from-slate-900/80 to-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-6 hover:border-slate-700 transition-colors group">
                    <div className="flex items-center gap-5">
                        <div className="p-4 bg-slate-800 rounded-2xl text-slate-300 group-hover:text-white group-hover:bg-slate-700 transition-colors">
                            <HelpCircle className="w-8 h-8" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white mb-1">Hulp Nodig?</h3>
                            <p className="text-slate-400 text-sm">
                                Bekijk de handleiding om te leren hoe de verschillende modules werken.
                            </p>
                        </div>
                    </div>
                </div>
            </Link>

        </div >
    );
}
