import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import TopHeader from "@/components/TopHeader";
import PageTransition from "@/components/PageTransition";
import UpdateBanner from "@/components/UpdateBanner";

export const metadata: Metadata = {
  title: "ValueTracker",
  description: "Parttracker BV — automated surplus inventory valuation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl" className="dark" suppressHydrationWarning>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased h-screen w-screen bg-slate-950 text-slate-200 selection:bg-brand-500 selection:text-white flex overflow-hidden">
        <UpdateBanner />

        {/* Persistent Sidebar */}
        <Sidebar />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col relative overflow-hidden bg-[#0A0E17]">
          {/* Subtle global background gradients for premium feel */}
          <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
            <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] rounded-full bg-brand-500/10 blur-[120px]" />
            <div className="absolute top-[40%] left-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-500/10 blur-[120px]" />
          </div>

          {/* Top Header */}
          <TopHeader />

          {/* Scrollable Page Content */}
          <main className="flex-1 overflow-x-hidden overflow-y-auto relative z-10 custom-scrollbar">
            <div className="h-full">
              <PageTransition>
                {children}
              </PageTransition>
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
