import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { secureFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    LineChart,
    Line,
} from "recharts";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Filter, Download, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function CustomReports() {
    const [reportType, setReportType] = useState("sales_analysis");
    const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({
        from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        to: new Date(),
    });

    // Query for report data
    const { data, isLoading, refetch } = useQuery({
        queryKey: ["custom-reports", reportType, dateRange.from, dateRange.to],
        queryFn: async () => {
            if (!dateRange.from || !dateRange.to) return null;
            const params = new URLSearchParams({
                type: reportType,
                from: dateRange.from.toISOString(),
                to: dateRange.to.toISOString(),
            });
            const res = await secureFetch(`/api/op/reports/builder?${params}`);
            if (!res.ok) throw new Error("Failed to fetch report");
            return res.json();
        },
    });

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat("en-KE", {
            style: "currency",
            currency: "KES",
            maximumFractionDigits: 0,
        }).format(val);

    return (
        <div className="min-h-screen bg-slate-950 p-6 pb-20">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <Link href="/partner">
                    <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
                        <ArrowLeft className="h-6 w-6" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight">Analytics & Reports</h1>
                    <p className="text-slate-400">Customizable insights engine</p>
                </div>
            </div>

            {/* Controls */}
            <Card className="bg-slate-900 border-slate-800 mb-6">
                <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-end md:items-center">
                    <div className="space-y-2 flex-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Report Type</label>
                        <Select value={reportType} onValueChange={setReportType}>
                            <SelectTrigger className="bg-slate-950 border-slate-800 text-white">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-800 text-white">
                                <SelectItem value="sales_analysis">Sales Performance</SelectItem>
                                <SelectItem value="product_margins">Profitability & Margins</SelectItem>
                                <SelectItem value="ingredient_usage">Ingredient Consumption</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2 flex-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Date Range</label>
                        <div className="flex gap-2">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-start text-left font-normal bg-slate-950 border-slate-800 text-white">
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {dateRange.from ? format(dateRange.from, "PPP") : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 bg-slate-900 border-slate-800">
                                    <Calendar mode="single" selected={dateRange.from} onSelect={(d) => setDateRange((prev) => ({ ...prev, from: d }))} initialFocus />
                                </PopoverContent>
                            </Popover>
                            <span className="text-white self-center">-</span>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-start text-left font-normal bg-slate-950 border-slate-800 text-white">
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {dateRange.to ? format(dateRange.to, "PPP") : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 bg-slate-900 border-slate-800">
                                    <Calendar mode="single" selected={dateRange.to} onSelect={(d) => setDateRange((prev) => ({ ...prev, to: d }))} initialFocus />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>

                    <Button className="bg-purple-600 hover:bg-purple-700 text-white" onClick={() => refetch()}>
                        <Filter className="mr-2 h-4 w-4" />
                        Run Report
                    </Button>
                </CardContent>
            </Card>

            {/* Content Area */}
            {isLoading ? (
                <div className="text-center py-20 text-slate-500">Generating analytics...</div>
            ) : !data ? (
                <div className="text-center py-20 text-slate-500">Select parameters to view report</div>
            ) : (
                <div className="space-y-6">

                    {/* SALES ANALYSIS VIEW */}
                    {reportType === "sales_analysis" && (
                        <>
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Card className="bg-slate-900/50 border-slate-800">
                                    <CardContent className="p-6">
                                        <p className="text-slate-500 text-xs font-bold uppercase">Total Revenue</p>
                                        <p className="text-2xl font-black text-white mt-1">
                                            {formatCurrency(data.summary.reduce((acc: any, item: any) => acc + item.revenue, 0))}
                                        </p>
                                    </CardContent>
                                </Card>
                                <Card className="bg-slate-900/50 border-slate-800">
                                    <CardContent className="p-6">
                                        <p className="text-slate-500 text-xs font-bold uppercase">Units Sold</p>
                                        <p className="text-2xl font-black text-white mt-1">
                                            {data.summary.reduce((acc: any, item: any) => acc + item.quantity, 0).toLocaleString()}
                                        </p>
                                    </CardContent>
                                </Card>
                                <Card className="bg-slate-900/50 border-slate-800">
                                    <CardContent className="p-6">
                                        <p className="text-slate-500 text-xs font-bold uppercase">Active Products</p>
                                        <p className="text-2xl font-black text-white mt-1">{data.summary.length}</p>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Sales Chart */}
                            <Card className="bg-slate-900 border-slate-800">
                                <CardHeader>
                                    <CardTitle className="text-white">Revenue Trend</CardTitle>
                                </CardHeader>
                                <CardContent className="h-[300px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={data.trend}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                            <XAxis dataKey="date" stroke="#64748b" tickFormatter={(val) => format(new Date(val), "dd MMM")} />
                                            <YAxis stroke="#64748b" tickFormatter={(val) => `K${(val / 1000).toFixed(0)}k`} />
                                            <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155" }} />
                                            <Bar dataKey="revenue" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>

                            {/* Detailed Table */}
                            <Card className="bg-slate-900 border-slate-800">
                                <CardHeader>
                                    <CardTitle className="text-white">Product Performance</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="relative overflow-x-auto">
                                        <table className="w-full text-sm text-left text-slate-400">
                                            <thead className="text-xs text-slate-500 uppercase bg-slate-950">
                                                <tr>
                                                    <th className="px-6 py-3">Product Name</th>
                                                    <th className="px-6 py-3 text-right">Units Sold</th>
                                                    <th className="px-6 py-3 text-right">Revenue</th>
                                                    <th className="px-6 py-3 text-right">Avg Price</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {data.summary.map((item: any) => (
                                                    <tr key={item.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                                                        <td className="px-6 py-4 font-medium text-white">{item.name}</td>
                                                        <td className="px-6 py-4 text-right">{item.quantity}</td>
                                                        <td className="px-6 py-4 text-right font-bold text-emerald-400">{formatCurrency(item.revenue)}</td>
                                                        <td className="px-6 py-4 text-right">
                                                            {formatCurrency(item.revenue / (item.quantity || 1))}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>
                        </>
                    )}

                    {/* PRODUCT MARGINS VIEW */}
                    {reportType === "product_margins" && (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <Card className="bg-emerald-950/20 border-emerald-500/20">
                                    <CardContent className="p-6">
                                        <p className="text-emerald-500/70 text-xs font-bold uppercase">Total Revenue</p>
                                        <p className="text-2xl font-black text-emerald-400 mt-1">{formatCurrency(data.totalRevenue)}</p>
                                    </CardContent>
                                </Card>
                                <Card className="bg-red-950/20 border-red-500/20">
                                    <CardContent className="p-6">
                                        <p className="text-red-500/70 text-xs font-bold uppercase">Cost of Goods (Actual)</p>
                                        <p className="text-2xl font-black text-red-400 mt-1">{formatCurrency(data.totalCOGS)}</p>
                                    </CardContent>
                                </Card>
                                <Card className="bg-blue-950/20 border-blue-500/20">
                                    <CardContent className="p-6">
                                        <p className="text-blue-500/70 text-xs font-bold uppercase">Net Margin</p>
                                        <p className="text-2xl font-black text-blue-400 mt-1">{formatCurrency(data.netMargin)}</p>
                                    </CardContent>
                                </Card>
                                <Card className="bg-slate-900 border-slate-800">
                                    <CardContent className="p-6">
                                        <p className="text-slate-500 text-xs font-bold uppercase">Margin %</p>
                                        <p className="text-2xl font-black text-white mt-1">{data.marginPercent.toFixed(1)}%</p>
                                    </CardContent>
                                </Card>
                            </div>

                            <Card className="bg-slate-900 border-slate-800">
                                <CardHeader>
                                    <CardTitle className="text-white">Product Revenue Contribution</CardTitle>
                                    <CardDescription className="text-slate-400">
                                        Note: COGS is calculated based on actual ingredient consumption linked to sales.
                                        Individual product margins are theoretical based on revenue share.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="relative overflow-x-auto">
                                        <table className="w-full text-sm text-left text-slate-400">
                                            <thead className="text-xs text-slate-500 uppercase bg-slate-950">
                                                <tr>
                                                    <th className="px-6 py-3">Product Name</th>
                                                    <th className="px-6 py-3 text-right">Units Sold</th>
                                                    <th className="px-6 py-3 text-right">Revenue</th>
                                                    <th className="px-6 py-3 text-right">% of Total Rev</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {data.products.map((item: any) => (
                                                    <tr key={item.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                                                        <td className="px-6 py-4 font-medium text-white">{item.name}</td>
                                                        <td className="px-6 py-4 text-right">{item.quantity}</td>
                                                        <td className="px-6 py-4 text-right font-bold text-emerald-400">{formatCurrency(item.revenue)}</td>
                                                        <td className="px-6 py-4 text-right">
                                                            {((item.revenue / data.totalRevenue) * 100).toFixed(1)}%
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>
                        </>
                    )}

                    {/* INGREDIENT USAGE VIEW */}
                    {reportType === "ingredient_usage" && (
                        <Card className="bg-slate-900 border-slate-800">
                            <CardHeader>
                                <CardTitle className="text-white">Ingredient Consumption</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="relative overflow-x-auto">
                                    <table className="w-full text-sm text-left text-slate-400">
                                        <thead className="text-xs text-slate-500 uppercase bg-slate-950">
                                            <tr>
                                                <th className="px-6 py-3">Date</th>
                                                <th className="px-6 py-3">Ingredient Name</th>
                                                <th className="px-6 py-3 text-right">Total Consumed</th>
                                                <th className="px-6 py-3">Unit</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.map((item: any, idx: number) => (
                                                <tr key={idx} className="border-b border-slate-800 hover:bg-slate-800/50">
                                                    <td className="px-6 py-4 font-medium text-white">{format(new Date(item.sale_date), "MMM dd, yyyy")}</td>
                                                    <td className="px-6 py-4">{item.ingredient_name}</td>
                                                    <td className="px-6 py-4 text-right font-bold text-white">{item.total_consumed}</td>
                                                    <td className="px-6 py-4 text-xs font-mono">{item.unit}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                </div>
            )}
        </div>
    );
}
