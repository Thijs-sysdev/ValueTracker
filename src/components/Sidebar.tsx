'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Home, Calculator, Database, History, Settings, HelpCircle } from 'lucide-react';
import pkg from '../../package.json';

const mainLinks = [
    { name: 'Dashboard', href: '/', icon: Home },
    { name: 'Waardebepaling', href: '/waardebepaling', icon: Calculator },
    { name: 'Database', href: '/beheer', icon: Database },
    { name: 'Prijs Database', href: '/prijs-database', icon: History },
];

const bottomLinks = [
    { name: 'Instellingen', href: '/instellingen', icon: Settings },
    { name: 'Help', href: '/help', icon: HelpCircle },
];

export default function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="w-64 bg-slate-950 border-r border-slate-800/60 flex flex-col h-screen shrink-0 relative z-20">
            <div className="p-6 flex items-center justify-center shrink-0 transition-transform hover:scale-105 duration-500">
                <Link href="/">
                    <Image
                        src="/logo.png"
                        alt="Logo"
                        width={160}
                        height={50}
                        className="w-auto h-10 object-contain filter invert opacity-90 hover:opacity-100 transition-opacity"
                        priority
                    />
                </Link>
            </div>

            <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto custom-scrollbar">
                {mainLinks.map((link) => {
                    const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
                    return (
                        <Link
                            key={link.name}
                            href={link.href}
                            className={`flex items-center gap-3.5 px-4 py-3 rounded-2xl text-sm transition-all duration-300 group ${isActive
                                ? 'bg-gradient-to-r from-brand-600/90 to-brand-500 text-white font-bold shadow-lg shadow-brand-500/20'
                                : 'text-slate-400 font-medium hover:text-white hover:bg-slate-800/50'
                                }`}
                        >
                            <link.icon
                                size={20}
                                className={`transition-colors ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-brand-400'}`}
                            />
                            {link.name}
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 space-y-1.5 border-t border-slate-800/50 bg-slate-950/50">
                {bottomLinks.map((link) => {
                    const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
                    return (
                        <Link
                            key={link.name}
                            href={link.href}
                            className={`flex items-center gap-3.5 px-4 py-3 rounded-2xl text-sm transition-all duration-300 group ${isActive
                                ? 'bg-slate-800 text-white font-bold shadow-sm'
                                : 'text-slate-400 font-medium hover:text-white hover:bg-slate-800/50'
                                }`}
                        >
                            <link.icon
                                size={18}
                                className={`transition-colors ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-amber-400'}`}
                            />
                            {link.name}
                        </Link>
                    );
                })}
                <div className="pt-4 flex justify-center w-full">
                    <span className="text-[10px] font-bold tracking-widest text-slate-600 uppercase">v{pkg.version}</span>
                </div>
            </div>
        </aside>
    );
}
