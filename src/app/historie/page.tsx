import Link from "next/link";
import { getHistories } from "@/lib/history";
import { History, FileSpreadsheet, ArrowLeft, ArrowRight, Eye, MousePointerClick } from "lucide-react";

export const dynamic = 'force-dynamic';

export default function HistoriePage() {
    const histories = getHistories();

    return (
        <div className="max-w-5xl mx-auto space-y-10 animate-in fade-in duration-700 pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <Link href="/" className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                            <ArrowLeft size={20} />
                        </Link>
                        <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Waardebepaling Historie</h2>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 max-w-2xl pl-11">
                        Bekijk eerdere waardebepalingen en de berekende resultaten.
                    </p>
                </div>
            </div>

            {/* History List */}
            <div className="glass-panel rounded-[2rem] overflow-hidden shadow-sm border border-slate-200/60 dark:border-slate-800 p-2">
                {histories.length === 0 ? (
                    <div className="p-16 text-center text-slate-500 flex flex-col items-center gap-4">
                        <History size={48} className="opacity-20" />
                        <p>Nog geen historie gevonden. Upload eerst een bestand.</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        {histories.map((item) => (
                            <Link
                                key={item.id}
                                href={`/historie/${item.id}`}
                                className="group flex flex-col md:flex-row md:items-center justify-between p-5 rounded-2xl hover:bg-white/60 dark:hover:bg-slate-800/50 transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700 cursor-pointer"
                            >
                                <div className="flex items-center gap-4 mb-4 md:mb-0">
                                    <div className="w-12 h-12 rounded-xl bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 flex items-center justify-center border border-brand-100 dark:border-brand-800/50 group-hover:scale-110 transition-transform">
                                        <FileSpreadsheet size={24} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-900 dark:text-white text-lg group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                                            {item.fileName}
                                        </h3>
                                        <div className="flex items-center gap-3 text-sm font-medium text-slate-500 mt-1">
                                            <span>{new Date(item.date).toLocaleString('nl-NL')}</span>
                                            <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700"></span>
                                            <span>{item.itemsProcessed} rijen</span>
                                            <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700"></span>
                                            <span className="text-emerald-600 dark:text-emerald-400">{Math.round((item.acceptedItems / item.itemsProcessed) * 100) || 0}% geaccepteerd</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6 justify-between md:justify-end pl-16 md:pl-0">
                                    <div className="text-left md:text-right">
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Verkoopwaarde</p>
                                        <p className="text-xl font-bold text-slate-900 dark:text-white">
                                            € {item.totalSalesValue.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                        </p>
                                    </div>
                                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-brand-500 group-hover:text-white transition-colors">
                                        <ArrowRight size={20} />
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>

        </div>
    );
}
