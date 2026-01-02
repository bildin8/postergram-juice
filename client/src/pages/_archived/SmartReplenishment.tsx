import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { ArrowLeft, TrendingUp, Package, Flame, Calendar, RefreshCw } from "lucide-react";
import { secureFetch } from "@/lib/api";

interface ReplenishmentItem {
    ingredientId: string;
    name: string;
    unit: string;
    totalUsedInPeriod: number;
    dailyAvgUsage: number;
    weeklyNeed: number;
    biweeklyNeed: number;
    usageLevel: 'high' | 'medium' | 'low';
}

interface ReplenishmentData {
    period: { from: string; to: string; days: number };
    note?: string;
    dataSource?: string;
    items: ReplenishmentItem[];
}

export default function SmartReplenishment() {
    const [days, setDays] = useState(30);
    const [customFrom, setCustomFrom] = useState("");
    const [customTo, setCustomTo] = useState("");
    const [useCustomRange, setUseCustomRange] = useState(false);

    // Build query params
    const buildParams = () => {
        const params = new URLSearchParams();
        if (useCustomRange && customFrom && customTo) {
            params.set("from", customFrom);
            params.set("to", customTo);
        } else {
            params.set("days", days.toString());
        }
        return params.toString();
    };

    const { data, isLoading, error, refetch } = useQuery<ReplenishmentData>({
        queryKey: ["/api/partner/insights/smart-replenishment", days, customFrom, customTo, useCustomRange],
        queryFn: async () => {
            const res = await secureFetch(`/api/partner/insights/smart-replenishment?${buildParams()}`);
            if (!res.ok) throw new Error("Failed to fetch");
            return res.json();
        },
    });

    // Group by usage level
    const highUsage = data?.items.filter(i => i.usageLevel === 'high') || [];
    const mediumUsage = data?.items.filter(i => i.usageLevel === 'medium') || [];
    const lowUsage = data?.items.filter(i => i.usageLevel === 'low') || [];

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-900 p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <Link href="/partner">
                        <Button variant="ghost" className="text-slate-400 hover:text-white mb-4">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Partner
                        </Button>
                    </Link>
                    <div className="flex flex-col lg:flex-row justify-between items-start gap-4">
                        <div>
                            <h1 className="text-3xl font-bold text-white mb-2">Smart Replenishment</h1>
                            <p className="text-slate-400">
                                Usage-based forecasting from sales history
                            </p>
                            {data?.note && (
                                <p className="text-xs text-amber-400 mt-1">{data.note}</p>
                            )}
                        </div>

                        {/* Date Range Filter */}
                        <Card className="bg-slate-800/50 border-slate-700 p-4">
                            <div className="flex flex-wrap gap-3 items-center">
                                <div className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-slate-400" />
                                    <span className="text-sm text-slate-400">Analyze:</span>
                                </div>

                                {/* Quick Presets */}
                                <div className="flex gap-1">
                                    {[7, 14, 30, 60].map((d) => (
                                        <Button
                                            key={d}
                                            size="sm"
                                            variant={days === d && !useCustomRange ? "default" : "outline"}
                                            className={days === d && !useCustomRange ? "bg-purple-600" : "border-slate-600 text-slate-300"}
                                            onClick={() => { setDays(d); setUseCustomRange(false); }}
                                        >
                                            {d}d
                                        </Button>
                                    ))}
                                </div>

                                {/* Custom Range Toggle */}
                                <Button
                                    size="sm"
                                    variant={useCustomRange ? "default" : "outline"}
                                    className={useCustomRange ? "bg-purple-600" : "border-slate-600 text-slate-300"}
                                    onClick={() => setUseCustomRange(!useCustomRange)}
                                >
                                    Custom
                                </Button>

                                <Button size="sm" variant="ghost" onClick={() => refetch()} className="text-slate-400">
                                    <RefreshCw className="h-4 w-4" />
                                </Button>
                            </div>

                            {/* Custom Date Inputs */}
                            {useCustomRange && (
                                <div className="flex gap-2 mt-3">
                                    <Input
                                        type="date"
                                        value={customFrom}
                                        onChange={(e) => setCustomFrom(e.target.value)}
                                        className="bg-slate-700 border-slate-600 text-white text-sm"
                                    />
                                    <Input
                                        type="date"
                                        value={customTo}
                                        onChange={(e) => setCustomTo(e.target.value)}
                                        className="bg-slate-700 border-slate-600 text-white text-sm"
                                    />
                                </div>
                            )}

                            {/* Current Selection Info */}
                            {data && (
                                <div className="mt-2 text-xs text-slate-500">
                                    {data.period.from} to {data.period.to} ({data.period.days} days)
                                    {data.dataSource && <span className="ml-2">• Source: {data.dataSource}</span>}
                                </div>
                            )}
                        </Card>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <Card className="bg-red-900/30 border-red-700">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-red-300 flex items-center gap-2">
                                <Flame className="h-4 w-4" />
                                High Usage
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-4xl font-bold text-red-400">
                                {highUsage.length}
                            </p>
                            <p className="text-xs text-red-300/70">ingredients (&gt;10/day)</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-amber-900/30 border-amber-700">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-amber-300 flex items-center gap-2">
                                <TrendingUp className="h-4 w-4" />
                                Medium Usage
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-4xl font-bold text-amber-400">
                                {mediumUsage.length}
                            </p>
                            <p className="text-xs text-amber-300/70">ingredients (5-10/day)</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-slate-800/50 border-slate-700">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
                                <Package className="h-4 w-4" />
                                Total Ingredients
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-4xl font-bold text-white">
                                {data?.items.length || 0}
                            </p>
                            <p className="text-xs text-slate-500">tracked from recipes</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Loading/Error States */}
                {isLoading && (
                    <div className="text-center py-20">
                        <div className="animate-spin h-8 w-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4" />
                        <p className="text-slate-400">Analyzing sales data...</p>
                    </div>
                )}

                {error && (
                    <Card className="bg-red-900/20 border-red-800">
                        <CardContent className="py-8 text-center">
                            <p className="text-red-400">Failed to load data. Make sure recipes are synced.</p>
                        </CardContent>
                    </Card>
                )}

                {/* Ingredient Usage Table */}
                {data && data.items.length > 0 && (
                    <Card className="bg-slate-800/50 border-slate-700">
                        <CardHeader>
                            <CardTitle className="text-white flex items-center gap-2">
                                <TrendingUp className="h-5 w-5 text-purple-400" />
                                Order Guide (Based on Usage)
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-slate-400 border-b border-slate-700">
                                            <th className="pb-3 font-medium">Ingredient</th>
                                            <th className="pb-3 text-right font-medium">Daily Avg</th>
                                            <th className="pb-3 text-right font-medium">Weekly Need</th>
                                            <th className="pb-3 text-right font-medium">2-Week Need</th>
                                            <th className="pb-3 text-right font-medium">Total Used</th>
                                            <th className="pb-3 text-center font-medium">Priority</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700">
                                        {data.items.map((item) => (
                                            <tr key={item.ingredientId} className="hover:bg-slate-700/30">
                                                <td className="py-3">
                                                    <div className="font-medium text-white">{item.name}</div>
                                                    <div className="text-xs text-slate-500">{item.unit}</div>
                                                </td>
                                                <td className="py-3 text-right text-white font-mono">
                                                    {item.dailyAvgUsage}
                                                </td>
                                                <td className="py-3 text-right text-emerald-400 font-mono font-medium">
                                                    {item.weeklyNeed}
                                                </td>
                                                <td className="py-3 text-right text-purple-400 font-mono">
                                                    {item.biweeklyNeed}
                                                </td>
                                                <td className="py-3 text-right text-slate-400 font-mono">
                                                    {item.totalUsedInPeriod}
                                                </td>
                                                <td className="py-3 text-center">
                                                    <Badge className={
                                                        item.usageLevel === 'high'
                                                            ? 'bg-red-600 text-white'
                                                            : item.usageLevel === 'medium'
                                                                ? 'bg-amber-600 text-white'
                                                                : 'bg-slate-600 text-slate-300'
                                                    }>
                                                        {item.usageLevel}
                                                    </Badge>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* No Data State */}
                {data && data.items.length === 0 && (
                    <Card className="bg-slate-800/50 border-slate-700">
                        <CardContent className="py-12 text-center">
                            <Package className="h-16 w-16 text-slate-600 mx-auto mb-4" />
                            <h2 className="text-xl font-bold text-white mb-2">No Usage Data</h2>
                            <p className="text-slate-400 mb-4">
                                No sales found for this period, or recipes not synced.
                            </p>
                            <Button
                                className="bg-purple-600"
                                onClick={() => refetch()}
                            >
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Refresh
                            </Button>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
