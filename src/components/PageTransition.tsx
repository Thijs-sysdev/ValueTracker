'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';

export default function PageTransition({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <AnimatePresence mode="popLayout">
            <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 15, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.2 } }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="h-full w-full"
            >
                {children}
            </motion.div>
        </AnimatePresence>
    );
}
