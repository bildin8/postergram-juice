import { useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { secureFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, TrendingUp, Calendar } from "lucide-react";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from "recharts";

interface PricePoint {
    actual_cost: number;
    quantity: number;
    created_at: string;
    item: {
        name: string;
    };
}

export default function SupplierAnalytics() {
    const [, params] = useRoute("/partner/suppliers/:id/analytics");
    const id = params?.id;

    const { data: analytics, isLoading } = useQuery({
        queryKey: [`/api/partner/suppliers/${id}/analytics`],
        queryFn: async () => {
            const res = await secureFetch(`/api/partner/suppliers/${id}/analytics`);
            return res.json();
        },
        enabled: !!id,
    });

    const { data: supplier } = useQuery({
        queryKey: ["/api/partner/suppliers"], // Ideally get single supplier, but we verify existence here
        queryFn: async () => {
            // In a real app we'd have a get-single endpoint or cache from list
            // For now just fetching list and finding
            const res = await secureFetch("/api/partner/suppliers");
            const list = await res.json();
            return list.find((s: any) => s.id === id);
        },
        enabled: !!id,
    });

    // Process data for chart
    const history = analytics?.priceHistory as PricePoint[] || [];

    // Group by date and item
    // We want a structure ideal for multiple lines:
    // data = [ { date: "Jan 1", "Item A": 100, "Item B": 200 } ]

    const chartDataMap = new Map<string, any>();
    const itemNames = new Set<string>();

    history.forEach(point => {
        const date = new Date(point.created_at).toLocaleDateString();
        const itemName = point.item?.name || "Unknown Item";
        itemNames.add(itemName);

        const entry = chartDataMap.get(date) || { date };
        // If multiple purchases same day, take average or last? Last is fine for trend.
        entry[itemName] = point.actual_cost;
        chartDataMap.set(date, entry);
    });

    // Sort by date (naive string sort might fail for different months, need real date sort)
    const sortedData = Array.from(chartDataMap.values()).sort((a, b) => {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    // Generate random colors for lines
    const colors = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-900 p-6">
            <div className="max-w-6xl mx-auto">
                <div className="mb-8">
                    <Link href="/partner/suppliers">
                        <Button variant="ghost" className="text-slate-400 hover:text-white mb-4">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Suppliers
                        </Button>
                    </Link>
                    <h1 className="text-3xl font-bold text-white mb-2">
                        {supplier?.name || "Supplier"} Analytics
                    </h1>
                    <p className="text-slate-400">Price history and purchase trends</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <Card className="bg-slate-800/50 border-slate-700">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-slate-400">
                                Total Purchases Tracked
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-white">
                                {history.length}
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-slate-800/50 border-slate-700">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-slate-400">
                                Active Items
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-emerald-400">
                                {itemNames.size}
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-slate-800/50 border-slate-700">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-slate-400">
                                Latest Purchase
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-xl font-bold text-blue-400">
                                {history.length > 0
                                    ? new Date(history[history.length - 1].created_at).toLocaleDateString()
                                    : "N/A"
                                }
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-emerald-500" />
                            Price Trends
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[400px]">
                        {isLoading ? (
                            <div className="flex items-center justify-center h-full text-slate-400">Loading chart...</div>
                        ) : sortedData.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-slate-400">
                                No purchase history available for this supplier yet.
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={sortedData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                    <XAxis
                                        dataKey="date"
                                        stroke="#9ca3af"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <YAxis
                                        stroke="#9ca3af"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(value) => `KES ${value}`}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                                        itemStyle={{ color: '#e2e8f0' }}
                                    />
                                    <Legend />
                                    {Array.from(itemNames).map((name, index) => (
                                        <Line
                                            key={name}
                                            type="monotone"
                                            dataKey={name}
                                            stroke={colors[index % colors.length]}
                                            strokeWidth={2}
                                            dot={{ r: 4, fill: colors[index % colors.length] }}
                                            activeDot={{ r: 6 }}
                                        />
                                    ))}
                                </LineChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
