import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { ArrowLeft, TrendingUp, Package, AlertTriangle, CheckCircle } from "lucide-react";
import { secureFetch } from "@/lib/api";

interface ReplenishmentItem {
    ingredientId: string;
    name: string;
    unit: string;
    totalUsed30d: number;
    dailyAvgUsage: number;
    currentStock: number;
    requiredForCoverage: number;
    recommendedOrder: number;
    status: 'reorder' | 'ok';
}

interface ReplenishmentData {
    period: { from: string; to: string; days: number };
    coverageTargetDays: number;
    items: ReplenishmentItem[];
}

export default function SmartReplenishment() {
    const { data, isLoading, error } = useQuery<ReplenishmentData>({
        queryKey: ["/api/partner/insights/smart-replenishment"],
        queryFn: async () => {
            const res = await secureFetch("/api/partner/insights/smart-replenishment");
            if (!res.ok) throw new Error("Failed to fetch");
            return res.json();
        },
    });

    const reorderItems = data?.items.filter(i => i.status === 'reorder') || [];
    const okItems = data?.items.filter(i => i.status === 'ok') || [];

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
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-3xl font-bold text-white mb-2">Smart Replenishment</h1>
                            <p className="text-slate-400">
                                AI-calculated reorder suggestions based on 30-day sales history
                            </p>
                        </div>
                        {data && (
                            <div className="text-right">
                                <p className="text-sm text-slate-400">Analysis Period</p>
                                <p className="text-white font-medium">Last {data.period.days} Days</p>
                                <p className="text-xs text-slate-500">
                                    Coverage Target: {data.coverageTargetDays} days
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <Card className="bg-red-900/30 border-red-700">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-red-300 flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4" />
                                Needs Reorder
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-4xl font-bold text-red-400">
                                {reorderItems.length}
                            </p>
                            <p className="text-xs text-red-300/70">ingredients below target</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-emerald-900/30 border-emerald-700">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-emerald-300 flex items-center gap-2">
                                <CheckCircle className="h-4 w-4" />
                                Well Stocked
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-4xl font-bold text-emerald-400">
                                {okItems.length}
                            </p>
                            <p className="text-xs text-emerald-300/70">ingredients at target</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-slate-800/50 border-slate-700">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
                                <Package className="h-4 w-4" />
                                Total Tracked
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-4xl font-bold text-white">
                                {data?.items.length || 0}
                            </p>
                            <p className="text-xs text-slate-500">ingredients analyzed</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Loading/Error States */}
                {isLoading && (
                    <div className="text-center py-20">
                        <div className="animate-spin h-8 w-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4" />
                        <p className="text-slate-400">Analyzing 30-day sales data...</p>
                    </div>
                )}

                {error && (
                    <Card className="bg-red-900/20 border-red-800">
                        <CardContent className="py-8 text-center">
                            <p className="text-red-400">Failed to load replenishment data</p>
                        </CardContent>
                    </Card>
                )}

                {/* Reorder List */}
                {data && reorderItems.length > 0 && (
                    <div className="mb-8">
                        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                            Action Required
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {reorderItems.map((item) => (
                                <Card key={item.ingredientId} className="bg-amber-900/20 border-amber-700/50 hover:border-amber-600 transition-colors">
                                    <CardContent className="p-4">
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <h3 className="font-bold text-white">{item.name}</h3>
                                                <p className="text-xs text-slate-400">{item.unit}</p>
                                            </div>
                                            <Badge className="bg-amber-600 text-white">
                                                Order {item.recommendedOrder}
                                            </Badge>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                            <div>
                                                <p className="text-slate-500">Current Stock</p>
                                                <p className="text-white">{item.currentStock}</p>
                                            </div>
                                            <div>
                                                <p className="text-slate-500">Daily Usage</p>
                                                <p className="text-white">{item.dailyAvgUsage}</p>
                                            </div>
                                            <div>
                                                <p className="text-slate-500">30-Day Total</p>
                                                <p className="text-white">{item.totalUsed30d}</p>
                                            </div>
                                            <div>
                                                <p className="text-slate-500">7-Day Target</p>
                                                <p className="text-white">{item.requiredForCoverage}</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}

                {/* OK List */}
                {data && okItems.length > 0 && (
                    <div>
                        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <CheckCircle className="h-5 w-5 text-emerald-500" />
                            Well Stocked
                        </h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-slate-500 border-b border-slate-700">
                                        <th className="pb-3 font-medium">Ingredient</th>
                                        <th className="pb-3 text-right font-medium">Current</th>
                                        <th className="pb-3 text-right font-medium">Daily Avg</th>
                                        <th className="pb-3 text-right font-medium">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {okItems.map((item) => (
                                        <tr key={item.ingredientId} className="hover:bg-slate-800/30">
                                            <td className="py-3 text-white">{item.name}</td>
                                            <td className="py-3 text-right text-slate-300">
                                                {item.currentStock} {item.unit}
                                            </td>
                                            <td className="py-3 text-right text-slate-400">
                                                {item.dailyAvgUsage}
                                            </td>
                                            <td className="py-3 text-right">
                                                <Badge className="bg-emerald-600/30 text-emerald-400 border border-emerald-700">
                                                    OK
                                                </Badge>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
