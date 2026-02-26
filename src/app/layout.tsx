import type { Metadata } from "next";
import Image from "next/image";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import "./globals.css";
export const metadata: Metadata = {
  title: "Parttracker Waardebepaling",
  description: "Automated surplus inventory valuation built with Next.js",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl" suppressHydrationWarning>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased min-h-screen relative selection:bg-brand-500 selection:text-white">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {/* Modern decorative background gradients */}
          <div className="fixed inset-0 -z-10 h-full w-full bg-slate-50 dark:bg-slate-950">
            <div className="absolute bottom-auto left-auto right-0 top-0 h-[500px] w-[500px] -translate-x-[30%] translate-y-[20%] rounded-full bg-teal-400/20 blur-[120px] dark:bg-teal-900/30"></div>
            <div className="absolute bottom-0 left-0 right-auto top-auto h-[500px] w-[500px] translate-x-[10%] -translate-y-[20%] rounded-full bg-blue-400/20 blur-[120px] dark:bg-blue-900/30"></div>
          </div>

          {/* Navbar */}
          <header className="sticky top-0 z-50 w-full glass-panel border-b border-white/20 dark:border-slate-800/50">
            <div className="container mx-auto px-4 h-20 flex items-center justify-between">
              {/* Left Box */}
              <div className="flex-1 flex justify-start">
                {/* Left empty for symmetry context, could hold breadcrumbs or back button */}
              </div>

              {/* Center Logo */}
              <div className="flex items-center justify-center shrink-0 transition-transform hover:scale-105 active:scale-95 duration-500">
                <Image
                  src="/logo.png"
                  alt="Parttracker logo"
                  width={180}
                  height={60}
                  className="h-12 w-auto object-contain dark:bg-white dark:p-1.5 dark:rounded-lg"
                  priority
                />
              </div>

              {/* Right Box */}
              <div className="flex-1 flex justify-end items-center gap-4">
                <a
                  href="/instellingen"
                  title="Instellingen"
                  className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </a>
                <ThemeToggle />
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-white/60 dark:bg-slate-800/60 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700/50 backdrop-blur-md shadow-sm">
                  v1.0
                </span>
              </div>
            </div>
          </header>

          <main className="container mx-auto px-4 py-12 relative z-10">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
