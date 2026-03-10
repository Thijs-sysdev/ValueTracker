'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Home, Calculator, Database, History, Settings, HelpCircle } from 'lucide-react';
import pkg from '../../package.json';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from '@/components/ui/button';

const mainLinks = [
    { name: 'Dashboard', href: '/', icon: Home },
    { name: 'Waardebepaling', href: '/waardebepaling', icon: Calculator },
    { name: 'Prijslijsten Beheer', href: '/prijslijsten-beheer', icon: Database },
    { name: 'Database', href: '/database', icon: History },
];

const bottomLinks = [
    { name: 'Instellingen', href: '/instellingen', icon: Settings },
    { name: 'Help', href: '/help', icon: HelpCircle },
];

export default function Sidebar() {
    const pathname = usePathname();

    return (
        <TooltipProvider delayDuration={150}>
            <aside className="w-64 bg-transparent flex flex-col h-screen shrink-0 relative z-20">
                <div className="p-6 flex items-center justify-center shrink-0 transition-transform hover:scale-105 duration-500">
                    <Link href="/">
                        <Image
                            src="/logo.png"
                            alt="Logo"
                            width={160}
                            height={50}
                            className="w-auto h-10 object-contain opacity-90 hover:opacity-100 transition-opacity"
                            priority
                        />
                    </Link>
                </div>

                <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto custom-scrollbar">
                    {mainLinks.map((link) => {
                        const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
                        return (
                            <Link key={link.name} href={link.href} className="block w-full">
                                <Button
                                    variant={isActive ? "default" : "ghost"}
                                    className={`w-full justify-start h-11 px-4 text-sm font-medium transition-all group ${isActive ? 'bg-primary/90 hover:bg-primary shadow-lg shadow-primary/20' : 'hover:bg-primary/10 hover:text-primary'}`}
                                >
                                    <link.icon className={`mr-3 h-5 w-5 transition-colors ${isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-primary'}`} />
                                    {link.name}
                                </Button>
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 space-y-2 bg-transparent border-t border-border/50">
                    {bottomLinks.map((link) => {
                        const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
                        return (
                            <Tooltip key={link.name}>
                                <TooltipTrigger asChild>
                                    <Link href={link.href} className="block w-full">
                                        <Button
                                            variant={isActive ? "secondary" : "ghost"}
                                            className={`w-full justify-start h-10 px-4 text-sm transition-all group ${isActive ? 'bg-secondary font-semibold' : 'hover:bg-secondary/50 text-muted-foreground'}`}
                                        >
                                            <link.icon className={`mr-3 h-[18px] w-[18px] transition-colors ${isActive ? 'text-foreground' : 'text-muted-foreground group-hover:text-brand-400'}`} />
                                            {link.name}
                                        </Button>
                                    </Link>
                                </TooltipTrigger>
                                <TooltipContent side="right">
                                    <p>Navigeer naar {link.name}</p>
                                </TooltipContent>
                            </Tooltip>
                        );
                    })}
                    <div className="pt-4 flex justify-center w-full">
                        <span className="text-[10px] font-bold tracking-widest text-muted-foreground/60 uppercase">v{pkg.version}</span>
                    </div>
                </div>
            </aside>
        </TooltipProvider>
    );
}
