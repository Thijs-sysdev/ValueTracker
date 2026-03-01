'use client';

/**
 * AiPriceChart.tsx
 *
 * Renders a polished dark-mode area chart of average price evolution
 * for a given manufacturer across multiple years.
 *
 * Used inside the AI Spotlight overlay in TopHeader.tsx when the AI detects
 * a trend analysis question and provides structured chart data.
 */

import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { YearlyAverage } from '@/lib/ai/aggregator';

interface AiPriceChartProps {
    manufacturer: string;
    yearlyData: YearlyAverage[];
    totalArticles: number;
}

// Custom Recharts Tooltip
function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-xl text-xs">
            <p className="font-semibold text-foreground mb-1">{label}</p>
            <p className="text-primary">Gemiddeld: <span className="font-bold">€{payload[0]?.value?.toFixed(2)}</span></p>
            <p className="text-muted-foreground">{payload[0]?.payload?.articleCount} prijspunten</p>
        </div>
    );
}

export default function AiPriceChart({ manufacturer, yearlyData, totalArticles }: AiPriceChartProps) {
    if (!yearlyData || yearlyData.length === 0) return null;

    const firstPrice = yearlyData[0].avgPrice;
    const lastPrice = yearlyData[yearlyData.length - 1].avgPrice;
    const pctChange = firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0;
    const isUp = pctChange > 0;
    const isFlat = Math.abs(pctChange) < 1;

    const TrendIcon = isFlat ? Minus : isUp ? TrendingUp : TrendingDown;
    const trendColor = isFlat ? 'text-muted-foreground' : isUp ? 'text-emerald-400' : 'text-red-400';

    return (
        <div className="mt-4 rounded-xl border border-border bg-muted/20 p-4 space-y-3 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-xs text-muted-foreground">Prijsontwikkeling</p>
                    <h4 className="font-bold text-foreground">{manufacturer}</h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{totalArticles} artikelen · {yearlyData[0].year}–{yearlyData[yearlyData.length - 1].year}</p>
                </div>
                <div className={`flex items-center gap-1.5 font-bold text-sm ${trendColor}`}>
                    <TrendIcon className="h-4 w-4" />
                    {isFlat ? 'Stabiel' : `${isUp ? '+' : ''}${pctChange.toFixed(1)}%`}
                </div>
            </div>

            {/* Chart */}
            <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={yearlyData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis
                        dataKey="year"
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <YAxis
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `€${v}`}
                        width={60}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                        type="monotone"
                        dataKey="avgPrice"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        fill="url(#priceGradient)"
                        dot={{ r: 3, fill: 'hsl(var(--primary))', strokeWidth: 0 }}
                        activeDot={{ r: 5 }}
                    />
                </AreaChart>
            </ResponsiveContainer>

            {/* Year-over-year legend */}
            <div className="flex gap-3 flex-wrap">
                {yearlyData.map(y => (
                    <div key={y.year} className="text-[11px] text-muted-foreground">
                        <span className="font-semibold text-foreground">{y.year}</span> €{y.avgPrice.toFixed(0)}
                    </div>
                ))}
            </div>
        </div>
    );
}
