import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    ArrowLeft,
    Scale,
    ArrowUp,
    ArrowDown,
    Minus,
    Calendar,
    ClipboardList
} from "lucide-react";
import { Link } from "wouter";

interface StockVariance {
    itemId: string;
    itemName: string;
    opening: number;
    closing: number;
    sold: number;
    dispatched: number;
    wastage: number;
    expected: number;
    actual: number;
    variance: number;
    variancePercent: number;
    status: "over" | "under" | "ok";
}

interface ReconciliationData {
    date: string;
    variances: StockVariance[];
    summary: {
        totalItems: number;
        overItems: number;
        underItems: number;
        matchedItems: number;
        totalVarianceValue: number;
    };
}

export default function StockReconciliation() {
    // Fetch stock reconciliation
    const { data, isLoading } = useQuery<ReconciliationData>({
        queryKey: ["/api/partner/reconciliation/stock"],
        queryFn: async () => {
            const res = await fetch("/api/partner/reconciliation/stock");
            return res.json();
        },
    });

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "over":
                return <ArrowUp className="h-4 w-4 text-emerald-400" />;
            case "under":
                return <ArrowDown className="h-4 w-4 text-red-400" />;
            default:
                return <Minus className="h-4 w-4 text-slate-400" />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "over":
                return "bg-emerald-900/30 border-emerald-700";
            case "under":
                return "bg-red-900/30 border-red-700";
            default:
                return "bg-slate-800/50 border-slate-700";
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-900 p-6">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <Link href="/partner">
                        <Button variant="ghost" className="text-slate-400 hover:text-white mb-4">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Partner
                        </Button>
                    </Link>
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-white mb-2">Stock Reconciliation</h1>
                            <p className="text-slate-400 flex items-center gap-2">
                                <Calendar className="h-4 w-4" />
                                {data?.date ? new Date(data.date).toLocaleDateString() : "Today"}
                            </p>
                        </div>
                        <div className="flex items-center gap-4">
                            <Link href="/partner/stock-takes">
                                <Button variant="outline" className="border-purple-500 text-purple-400 hover:bg-purple-500/10">
                                    <ClipboardList className="h-4 w-4 mr-2" />
                                    View Sessions
                                </Button>
                            </Link>
                            <Scale className="h-10 w-10 text-purple-500" />
                        </div>
                    </div>
                </div>

                {/* Loading */}
                {isLoading && (
                    <div className="text-center py-12">
                        <p className="text-slate-400">Loading reconciliation...</p>
                    </div>
                )}

                {/* Summary Cards */}
                {data?.summary && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <Card className="bg-slate-800/50 border-slate-700">
                            <CardContent className="pt-6 text-center">
                                <p className="text-3xl font-bold text-white">{data.summary.totalItems}</p>
                                <p className="text-sm text-slate-400">Items Tracked</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-emerald-900/30 border-emerald-700">
                            <CardContent className="pt-6 text-center">
                                <p className="text-3xl font-bold text-emerald-400">{data.summary.matchedItems}</p>
                                <p className="text-sm text-emerald-300/70">Matched</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-amber-900/30 border-amber-700">
                            <CardContent className="pt-6 text-center">
                                <p className="text-3xl font-bold text-amber-400">{data.summary.overItems}</p>
                                <p className="text-sm text-amber-300/70">Over</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-red-900/30 border-red-700">
                            <CardContent className="pt-6 text-center">
                                <p className="text-3xl font-bold text-red-400">{data.summary.underItems}</p>
                                <p className="text-sm text-red-300/70">Under</p>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Variances Table */}
                {data?.variances && data.variances.length > 0 ? (
                    <Card className="bg-slate-800/50 border-slate-700">
                        <CardHeader>
                            <CardTitle className="text-white">Item Variances</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-700 text-slate-400">
                                            <th className="text-left py-3 px-2">Item</th>
                                            <th className="text-right py-3 px-2">Opening</th>
                                            <th className="text-right py-3 px-2">+ Received</th>
                                            <th className="text-right py-3 px-2">- Sold</th>
                                            <th className="text-right py-3 px-2">- Wastage</th>
                                            <th className="text-right py-3 px-2">Expected</th>
                                            <th className="text-right py-3 px-2">Actual</th>
                                            <th className="text-right py-3 px-2">Variance</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.variances.map((item) => (
                                            <tr
                                                key={item.itemId}
                                                className={`border-b border-slate-800 ${getStatusColor(item.status)}`}
                                            >
                                                <td className="py-3 px-2">
                                                    <div className="flex items-center gap-2">
                                                        {getStatusIcon(item.status)}
                                                        <span className="text-white font-medium">{item.itemName}</span>
                                                    </div>
                                                </td>
                                                <td className="text-right py-3 px-2 text-slate-300">
                                                    {item.opening}
                                                </td>
                                                <td className="text-right py-3 px-2 text-emerald-400">
                                                    +{item.dispatched}
                                                </td>
                                                <td className="text-right py-3 px-2 text-red-400">
                                                    -{item.sold}
                                                </td>
                                                <td className="text-right py-3 px-2 text-amber-400">
                                                    -{item.wastage}
                                                </td>
                                                <td className="text-right py-3 px-2 text-slate-300">
                                                    {item.expected}
                                                </td>
                                                <td className="text-right py-3 px-2 text-white font-medium">
                                                    {item.actual}
                                                </td>
                                                <td className="text-right py-3 px-2">
                                                    <Badge className={
                                                        item.variance > 0 ? "bg-emerald-600" :
                                                            item.variance < 0 ? "bg-red-600" : "bg-slate-600"
                                                    }>
                                                        {item.variance > 0 ? "+" : ""}{item.variance}
                                                        {item.variancePercent !== 0 && ` (${item.variancePercent}%)`}
                                                    </Badge>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                ) : !isLoading && (
                    <Card className="bg-slate-800/30 border-slate-700">
                        <CardContent className="py-12 text-center">
                            <Scale className="h-16 w-16 text-slate-600 mx-auto mb-4" />
                            <h2 className="text-xl font-bold text-white mb-2">No Reconciliation Data</h2>
                            <p className="text-slate-400">
                                Stock counts need to be performed to generate variances.
                            </p>
                        </CardContent>
                    </Card>
                )}

                {/* Formula Explanation */}
                <Card className="mt-6 bg-slate-800/30 border-slate-700">
                    <CardContent className="py-4">
                        <p className="text-sm text-slate-400 text-center">
                            <strong className="text-white">Expected</strong> = Opening + Received - Sold - Wastage
                            &nbsp;|&nbsp;
                            <strong className="text-white">Variance</strong> = Actual - Expected
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
