'use client';

import { Activity, Database, Scale, History, ChevronRight, Mail, BookOpen } from 'lucide-react';

export default function HelpPage() {
    const modules = [
        {
            title: 'Waardebepaling',
            icon: <Scale className="w-6 h-6 text-brand-400" />,
            description: 'Zet Excel-lijsten met artikelen om in een waardeduiding. Het systeem berekent inkoopprijzen (extern of consignatie) en weigert artikelen gebaseerd op de ingestelde afschrijvingsregels en condities.',
            items: [
                'Upload klantbestanden (.xlsx/.xls)',
                'Berekening op basis van leeftijd en conditie',
                'Accepteren of Afwijzen van artikels',
                'Exporteer consignatie en externe templates'
            ]
        },
        {
            title: 'Prijs Database',
            icon: <History className="w-6 h-6 text-blue-400" />,
            description: 'Zoek op een specifiek artikelnummer om prijshistorie over meerdere jaren te bekijken.',
            items: [
                'Doorzoek honderdduizenden actuele prijzen',
                'Bekijk grafieken van prijsontwikkeling',
                'Analyseer gemiddelde prijstrends',
            ]
        },
        {
            title: 'Database Beheer',
            icon: <Database className="w-6 h-6 text-emerald-400" />,
            description: 'Beheer het collectieve geheugen van ValueTracker door nieuwe leverancierslijsten te uploaden.',
            items: [
                'Overschrijf of voeg referentieprijzen toe',
                'Bekijk database statistieken',
                'Beheer metadata van geüploade lijsten'
            ]
        }
    ];

    return (
        <div className="max-w-5xl mx-auto space-y-10 animate-in fade-in duration-700 pb-12 pt-6">

            {/* Header */}
            <div className="flex flex-col gap-2 mb-8">
                <h2 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                    <div className="p-2.5 bg-slate-800 text-slate-300 rounded-xl relative group">
                        <div className="absolute inset-0 bg-slate-700/20 blur-xl group-hover:bg-slate-700/40 transition-colors"></div>
                        <BookOpen className="w-6 h-6 relative z-10" />
                    </div>
                    Handleiding & Help
                </h2>
                <p className="text-slate-400 text-lg">
                    Ontdek de mogelijkheden van het platform of zoek hulp bij specifieke vragen.
                </p>
            </div>

            {/* Modules Overview */}
            <div className="space-y-6">
                <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                    Module Overzicht
                </h3>

                <div className="grid gap-6">
                    {modules.map((module, i) => (
                        <div key={i} className="glass-panel p-8 rounded-3xl border border-white/5 bg-slate-900/40 hover:bg-slate-900/60 transition-colors relative overflow-hidden group flex flex-col md:flex-row gap-8">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-slate-500/5 rounded-full blur-[80px] group-hover:bg-brand-500/5 transition-colors pointer-events-none"></div>

                            <div className="md:w-1/3 shrink-0 flex flex-col gap-4 relative z-10">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-slate-800/80 rounded-xl">
                                        {module.icon}
                                    </div>
                                    <h4 className="text-xl font-bold text-white">{module.title}</h4>
                                </div>
                                <p className="text-sm text-slate-400 leading-relaxed font-medium">
                                    {module.description}
                                </p>
                            </div>

                            <div className="md:w-2/3 relative z-10 flex flex-col justify-center border-t md:border-t-0 md:border-l border-slate-800/50 pt-6 md:pt-0 md:pl-8">
                                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {module.items.map((item, j) => (
                                        <li key={j} className="flex items-start gap-3">
                                            <div className="p-1 rounded bg-slate-800/80 shrink-0 mt-0.5">
                                                <ChevronRight className="w-3 h-3 text-slate-400" />
                                            </div>
                                            <span className="text-sm text-slate-300 font-medium">{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Quick Tips */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
                <div className="glass-panel p-8 rounded-3xl border border-amber-500/10 bg-gradient-to-br from-amber-500/5 to-transparent relative overflow-hidden">
                    <h4 className="text-lg font-bold text-amber-500 mb-3 flex items-center gap-2">
                        <Activity className="w-5 h-5" />
                        B.L.A.S.T. Systeem
                    </h4>
                    <p className="text-sm text-slate-400 leading-relaxed font-medium">
                        Dit platform volgt stricte architectuurprotocollen (Blueprint, Link, Architect, Stylize, Trigger) voor de waardebepalingslogica. Zorg ervoor dat wijzigingen in bedrijfsregels altijd in de back-end constutitie worden vastgelegd.
                    </p>
                </div>

                <div className="glass-panel p-8 rounded-3xl border border-white/5 bg-slate-900/50 flex flex-col justify-center items-center text-center gap-4 hover:border-slate-700 transition-colors">
                    <div className="p-4 bg-slate-800 rounded-full text-slate-400">
                        <Mail className="w-8 h-8" />
                    </div>
                    <div>
                        <h4 className="text-lg font-bold text-white mb-1">Support Nodig?</h4>
                        <p className="text-sm text-slate-400">Neem contact op met de systeembeheerder bij technische problemen.</p>
                    </div>
                </div>
            </div>

        </div>
    );
}
