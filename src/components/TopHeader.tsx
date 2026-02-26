import { Search, Bell } from 'lucide-react';
import os from 'os';

export default function TopHeader() {
    const username = os.userInfo().username || 'Verkoper';

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
                            placeholder="Zoeken in orders of attributen..."
                            className="w-full bg-slate-900/50 text-white placeholder-slate-500 rounded-2xl py-3.5 pl-12 pr-4 border border-slate-800/50 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-transparent transition-all shadow-inner shadow-black/20"
                            suppressHydrationWarning
                        />
                    </div>
                </div>

                <div className="flex items-center gap-6 shrink-0 ml-4">
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
