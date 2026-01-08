import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { secureFetch } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    RefreshCw, TrendingUp, TrendingDown, DollarSign, Package,
    AlertTriangle, Clock, ShoppingCart, Zap, BarChart3,
    ArrowUpRight, ArrowDownRight, Activity, Calendar, ListOrdered,
    History, PieChart, Info, Shield
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart as RePieChart, Pie, Cell } from 'recharts';

interface Transaction {
    id: string;
    poster_transaction_id: string;
    transaction_date: string;
    total_amount: number;
    pay_type: string;
    payed_cash: number;
    payed_card: number;
    products: any[];
}

interface ConsumptionItem {
    ingredient_id: string;
    ingredient_name: string;
    total_consumed: number;
    unit: string;
    transaction_count: number;
}

interface StockItem {
    id: string;
    name: string;
    unit: string;
    store_stock: number;
    shop_stock: number;
    total_consumed: number;
}

interface SyncStatus {
    transactions: {
        lastSyncAt: string | null;
        recordsSynced: number;
        status: string;
    };
    recipes: {
        lastSyncAt: string | null;
        recordsSynced: number;
        status: string;
    };
}

interface DailySummary {
    summary_date: string;
    total_sales: number;
    cash_sales: number;
    card_sales: number;
    transaction_count: number;
    total_consumption_cost: number;
    items_consumed: number;
    stock_variance_value: number;
    cash_variance: number;
}

export default function PowerDashboard() {
    const [refreshKey, setRefreshKey] = useState(0);
    const [reportDays, setReportDays] = useState(14);

    // ============================================================================
    // LIVE QUERIES
    // ============================================================================

    const { data: transactions = [], isLoading: txLoading } = useQuery<Transaction[]>({
        queryKey: ['op-transactions', refreshKey],
        queryFn: async () => {
            try {
                const res = await secureFetch('/api/op/transactions?limit=20');
                if (!res.ok) return [];
                return res.json();
            } catch (e) {
                return [];
            }
        },
        refetchInterval: 30000,
    });

    const { data: todaySummary } = useQuery({
        queryKey: ['op-transactions-summary', refreshKey],
        queryFn: async () => {
            try {
                const res = await secureFetch('/api/op/transactions/summary');
                if (!res.ok) return null;
                return res.json();
            } catch (e) {
                return null;
            }
        },
        refetchInterval: 60000,
    });

    const { data: stock = [] } = useQuery<StockItem[]>({
        queryKey: ['op-stock', refreshKey],
        queryFn: async () => {
            try {
                const res = await secureFetch('/api/op/ingredients/stock');
                if (!res.ok) return [];
                return res.json();
            } catch (e) {
                return [];
            }
        },
        refetchInterval: 120000,
    });

    const { data: syncStatus } = useQuery<SyncStatus>({
        queryKey: ['op-sync-status', refreshKey],
        queryFn: async () => {
            try {
                const res = await secureFetch('/api/op/sync/status');
                if (!res.ok) return { transactions: { status: 'unknown' }, recipes: { status: 'unknown' } };
                return res.json();
            } catch (e) {
                return { transactions: { status: 'unknown' }, recipes: { status: 'unknown' } };
            }
        },
        refetchInterval: 60000,
    });

    const { data: pendingReorders = [] } = useQuery({
        queryKey: ['op-reorders-pending', refreshKey],
        queryFn: async () => {
            try {
                const res = await secureFetch('/api/op/reorders/pending');
                if (!res.ok) return [];
                return res.json();
            } catch (e) {
                return [];
            }
        },
        refetchInterval: 120000,
    });

    // ============================================================================
    // HISTORICAL REPORT QUERIES
    // ============================================================================

    const { data: dailyHistory = [], isLoading: historyLoading } = useQuery<DailySummary[]>({
        queryKey: ['op-reports-daily', reportDays, refreshKey],
        queryFn: async () => {
            try {
                const res = await secureFetch(`/api/op/reports/daily-summary?days=${reportDays}`);
                if (!res.ok) return [];
                return res.json();
            } catch (e) {
                return [];
            }
        },
    });

    const { data: topSellers = [] } = useQuery({
        queryKey: ['op-reports-sellers', reportDays, refreshKey],
        queryFn: async () => {
            try {
                const res = await secureFetch(`/api/op/reports/top-sellers?days=${reportDays}`);
                if (!res.ok) return [];
                return res.json();
            } catch (e) {
                return [];
            }
        },
    });

    const { data: consumptionTrends } = useQuery({
        queryKey: ['op-reports-consumption', reportDays, refreshKey],
        queryFn: async () => {
            try {
                const res = await secureFetch(`/api/op/reports/consumption-trends?days=${reportDays}`);
                if (!res.ok) return {};
                return res.json();
            } catch (e) {
                return {};
            }
        },
    });

    const handleRefresh = () => setRefreshKey(k => k + 1);

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-KE', { weekday: 'short', month: 'short', day: 'numeric' });
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(amount);
    };

    // Calculate low stock items
    const lowStockItems = stock.filter(item =>
        item.shop_stock < 1000 && item.total_consumed > 0
    ).slice(0, 5);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-4 md:p-6 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div>
                    <h1 className="text-4xl font-black text-white flex items-center gap-3 tracking-tight">
                        <Zap className="h-10 w-10 text-yellow-400 fill-yellow-400/20" />
                        POWER<span className="text-yellow-400 underline decoration-yellow-400/30 underline-offset-8">DASH</span>
                    </h1>
                    <p className="text-slate-400 mt-2 font-medium">Real-time control & historical intelligence</p>
                </div>
                <div className="flex items-center gap-3 bg-slate-800/40 p-2 rounded-2xl border border-slate-700/50 backdrop-blur-md">
                    <Badge variant="outline" className="text-green-400 border-green-500/50 px-3 py-1 bg-green-500/5">
                        <Activity className="h-3 w-3 mr-1 animate-pulse" />
                        SYSTEM LIVE
                    </Badge>
                    <div className="h-4 w-px bg-slate-700" />
                    <Button onClick={handleRefresh} variant="ghost" size="sm" className="text-white hover:bg-slate-700/50">
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Sync Now
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="live" className="w-full space-y-6">
                <TabsList className="bg-slate-800/50 p-1 border border-slate-700/50 backdrop-blur-md rounded-xl h-12">
                    <TabsTrigger value="live" className="rounded-lg data-[state=active]:bg-yellow-500 data-[state=active]:text-slate-950 font-bold px-6 h-10 transition-all">
                        <Activity className="h-4 w-4 mr-2" />
                        LIVE FEED
                    </TabsTrigger>
                    <TabsTrigger value="historical" className="rounded-lg data-[state=active]:bg-purple-600 data-[state=active]:text-white font-bold px-6 h-10 transition-all">
                        <History className="h-4 w-4 mr-2" />
                        HISTORICAL REPORTS
                    </TabsTrigger>
                </TabsList>

                {/* ============================================================================ */}
                {/* LIVE DASHBOARD CONTENT                                                       */}
                {/* ============================================================================ */}
                <TabsContent value="live" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card className="bg-slate-800/40 border-slate-700/50 overflow-hidden relative group">
                            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <CardContent className="p-6">
                                <div className="flex items-start justify-between">
                                    <div className="space-y-1">
                                        <p className="text-emerald-400/70 text-xs font-bold uppercase tracking-wider">Today's Revenue</p>
                                        <h3 className="text-3xl font-black text-white">{formatCurrency(todaySummary?.totalSales || 0)}</h3>
                                        <div className="flex items-center gap-1 text-emerald-400 text-xs font-medium">
                                            <ArrowUpRight className="h-3 w-3" />
                                            {todaySummary?.transactionCount || 0} Successful Orders
                                        </div>
                                    </div>
                                    <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
                                        <DollarSign className="h-6 w-6 text-emerald-400" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-slate-800/40 border-slate-700/50 overflow-hidden relative group">
                            <CardContent className="p-6">
                                <div className="flex items-start justify-between">
                                    <div className="space-y-1">
                                        <p className="text-blue-400/70 text-xs font-bold uppercase tracking-wider">Cash vs Card</p>
                                        <div className="flex flex-col">
                                            <span className="text-white font-black text-xl">C: {formatCurrency(todaySummary?.cashSales || 0)}</span>
                                            <span className="text-slate-400 font-bold text-lg">D: {formatCurrency(todaySummary?.cardSales || 0)}</span>
                                        </div>
                                    </div>
                                    <div className="bg-blue-500/10 p-3 rounded-xl border border-blue-500/20">
                                        <BarChart3 className="h-6 w-6 text-blue-400" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-slate-800/40 border-slate-700/50 overflow-hidden relative group">
                            <CardContent className="p-6">
                                <div className="flex items-start justify-between">
                                    <div className="space-y-1">
                                        <p className="text-purple-400/70 text-xs font-bold uppercase tracking-wider">Avg Ticket</p>
                                        <h3 className="text-3xl font-black text-white">
                                            {formatCurrency((todaySummary?.totalSales || 0) / Math.max(todaySummary?.transactionCount || 1, 1))}
                                        </h3>
                                        <p className="text-slate-400 text-xs">Per transaction today</p>
                                    </div>
                                    <div className="bg-purple-500/10 p-3 rounded-xl border border-purple-500/20">
                                        <ShoppingCart className="h-6 w-6 text-purple-400" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-slate-800/40 border-slate-700/50 overflow-hidden relative group">
                            <CardContent className="p-6">
                                <div className="flex items-start justify-between">
                                    <div className="space-y-1">
                                        <p className="text-amber-400/70 text-xs font-bold uppercase tracking-wider">Operational Health</p>
                                        <h3 className="text-3xl font-black text-white">{pendingReorders?.length || 0}</h3>
                                        <Badge variant="outline" className={pendingReorders?.length > 0 ? "border-amber-500 text-amber-400 bg-amber-500/5" : "border-green-500 text-green-400"}>
                                            {pendingReorders?.length > 0 ? "Reorders Pending" : "Store Health OK"}
                                        </Badge>
                                    </div>
                                    <div className="bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
                                        <Package className="h-6 w-6 text-amber-400" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Live Feed */}
                        <Card className="lg:col-span-2 bg-slate-900/50 border-slate-800 backdrop-blur-sm">
                            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800/50">
                                <div>
                                    <CardTitle className="text-white text-lg flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                                        Recent Transactions
                                    </CardTitle>
                                    <CardDescription>Live sales stream from Shop</CardDescription>
                                </div>
                                <Button variant="ghost" size="sm" className="text-slate-400 h-8">View All</Button>
                            </CardHeader>
                            <CardContent className="p-0">
                                <ScrollArea className="h-[450px]">
                                    <div className="divide-y divide-slate-800/50">
                                        {txLoading ? (
                                            <div className="p-8 text-center text-slate-500">Connecting to point of sale...</div>
                                        ) : transactions.length === 0 ? (
                                            <div className="p-20 text-center space-y-3">
                                                <div className="bg-slate-800 w-12 h-12 rounded-full flex items-center justify-center mx-auto opacity-20">
                                                    <Clock className="h-6 w-6" />
                                                </div>
                                                <p className="text-slate-500">Waiting for today's first sale</p>
                                            </div>
                                        ) : (
                                            transactions.map((tx, idx) => (
                                                <div key={tx.id} className="p-4 hover:bg-slate-800/30 transition-colors flex items-center justify-between group">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-xs ${tx.pay_type === 'cash' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                                                            'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                                                            }`}>
                                                            {tx.pay_type === 'cash' ? 'C' : 'D'}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-white font-bold">{formatCurrency(tx.total_amount)}</span>
                                                                <span className="text-slate-500 text-[10px] font-mono">#{tx.poster_transaction_id?.slice(-8)}</span>
                                                            </div>
                                                            <div className="text-[10px] text-slate-500 mt-0.5">
                                                                {tx.products?.length || 0} products • {formatTime(tx.transaction_date)}
                                                            </div>
                                                            <div className="text-[11px] text-slate-400 mt-1 font-medium leading-tight">
                                                                {tx.products?.map((p: any) => p.product_name || p.name || 'Unknown').join(', ')}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <Badge variant="secondary" className="bg-transparent text-slate-500 text-[10px] group-hover:text-slate-300 p-0 hover:bg-transparent">
                                                        <Clock className="h-3 w-3 mr-1" />
                                                        {new Date(tx.transaction_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </Badge>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </ScrollArea>
                            </CardContent>
                        </Card>

                        {/* Side Status Panes */}
                        <div className="space-y-6">
                            {/* Stock Health */}
                            <Card className="bg-slate-900/50 border-slate-800">
                                <CardHeader className="pb-3 border-b border-slate-800/50">
                                    <CardTitle className="text-white text-sm flex items-center gap-2 font-bold uppercase tracking-tight">
                                        <Package className="h-4 w-4 text-purple-400" />
                                        Critical Stock
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-4 px-0">
                                    <div className="px-4 space-y-3">
                                        {lowStockItems.length === 0 ? (
                                            <div className="py-2 text-center">
                                                <div className="flex justify-center mb-2">
                                                    <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center">
                                                        <Shield className="h-4 w-4 text-green-500" />
                                                    </div>
                                                </div>
                                                <p className="text-slate-500 text-xs">All thresholds healthy</p>
                                            </div>
                                        ) : (
                                            lowStockItems.map(item => (
                                                <div key={item.id} className="flex flex-col gap-1.5 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-white text-xs font-bold">{item.name}</span>
                                                        <Badge variant="outline" className="text-[10px] h-4 border-red-500/50 text-red-500 px-1 py-0 font-bold">CRITICAL</Badge>
                                                    </div>
                                                    <div className="flex items-end justify-between">
                                                        <div className="flex flex-col">
                                                            <span className="text-slate-500 text-[10px]">Shop Level:</span>
                                                        </div>
                                                        <span className="text-red-400 text-sm font-black tracking-tight underline decoration-red-500/30">
                                                            {item.shop_stock.toFixed(0)} {item.unit}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    <div className="mt-4 border-t border-slate-800/50 p-2">
                                        <Button variant="ghost" className="w-full h-8 text-xs text-slate-400 hover:text-white" asChild>
                                            <a href="/partner/items">View All Inventory</a>
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Sync Control */}
                            <Card className="bg-slate-950 border-slate-700/50 shadow-2xl">
                                <CardContent className="p-4 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <RefreshCw className={`h-4 w-4 ${syncStatus?.transactions?.status === 'syncing' ? 'animate-spin text-yellow-400' : 'text-slate-500'}`} />
                                            <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">POS Link</span>
                                        </div>
                                        <Badge className={syncStatus?.transactions?.status === 'idle' ? 'bg-emerald-500 text-slate-950 font-black' : 'bg-yellow-500 text-slate-950 font-black'}>
                                            {syncStatus?.transactions?.status?.toUpperCase() || 'IDLE'}
                                        </Badge>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-center border-t border-slate-800 pt-3">
                                        <div className="bg-slate-900/50 p-2 rounded-lg">
                                            <p className="text-slate-500 text-[8px] uppercase font-bold tracking-tighter mb-1">Last Contact</p>
                                            <p className="text-white text-xs font-mono font-bold">
                                                {syncStatus?.transactions?.lastSyncAt ? formatTime(syncStatus.transactions.lastSyncAt) : '??:??'}
                                            </p>
                                        </div>
                                        <div className="bg-slate-900/50 p-2 rounded-lg">
                                            <p className="text-slate-500 text-[8px] uppercase font-bold tracking-tighter mb-1">Records Today</p>
                                            <p className="text-white text-xs font-mono font-bold">{syncStatus?.transactions?.recordsSynced || 0}</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                {/* ============================================================================ */}
                {/* HISTORICAL REPORTS CONTENT                                                  */}
                {/* ============================================================================ */}
                <TabsContent value="historical" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="flex items-center justify-between bg-slate-800/30 p-4 rounded-xl border border-slate-700/50">
                        <div className="flex items-center gap-2 text-purple-200">
                            <Calendar className="h-4 w-4" />
                            <span className="text-sm font-semibold">Reporting Window:</span>
                            <Select
                                value={reportDays.toString()}
                                onValueChange={(v) => setReportDays(parseInt(v))}
                            >
                                <SelectTrigger className="w-[120px] bg-slate-900 border-purple-500/30 h-8 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-800 border-slate-700 text-white">
                                    <SelectItem value="1">Today</SelectItem>
                                    <SelectItem value="7">Last 7 Days</SelectItem>
                                    <SelectItem value="14">Last 14 Days</SelectItem>
                                    <SelectItem value="30">Last 30 Days</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <p className="text-[10px] text-slate-500 font-mono tracking-tight uppercase">Data aggregated from daily reconciliations & POS logs</p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Daily Sales Trend Chart */}
                        <Card className="bg-slate-900/50 border-slate-800 lg:col-span-2">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-white text-lg flex items-center gap-2">
                                    <TrendingUp className="h-5 w-5 text-emerald-400" />
                                    Daily Sales Trend
                                </CardTitle>
                                <CardDescription>Revenue performance over the last {reportDays} days</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[300px] w-full">
                                    {historyLoading ? (
                                        <div className="h-full flex items-center justify-center text-slate-500">Loading chart data...</div>
                                    ) : dailyHistory.length === 0 ? (
                                        <div className="h-full flex items-center justify-center text-slate-500">No data available for this period</div>
                                    ) : (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={[...dailyHistory].reverse()}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                                <XAxis
                                                    dataKey="summary_date"
                                                    stroke="#64748b"
                                                    fontSize={12}
                                                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}
                                                />
                                                <YAxis
                                                    stroke="#64748b"
                                                    fontSize={12}
                                                    tickFormatter={(value) => `K${(value / 1000).toFixed(0)}k`}
                                                />
                                                <RechartsTooltip
                                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }}
                                                    formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                                                    labelFormatter={(label) => new Date(label).toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long' })}
                                                />
                                                <Bar dataKey="total_sales" fill="#10b981" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Top Sellers List */}
                        <Card className="bg-slate-900/50 border-slate-800">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-white text-lg flex items-center gap-2">
                                    <ListOrdered className="h-5 w-5 text-yellow-400" />
                                    Top Selling Products
                                </CardTitle>
                                <CardDescription>Most revenue generated over last {reportDays} days</CardDescription>
                            </CardHeader>
                            <CardContent className="px-0">
                                <ScrollArea className="h-[350px]">
                                    <div className="px-6 space-y-3 pb-6">
                                        {topSellers.map((item: any, idx: number) => (
                                            <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-800/20 border border-slate-700/30 group hover:bg-slate-800/40 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-slate-600 font-bold font-mono text-xs w-5">{idx + 1}</span>
                                                    <div>
                                                        <p className="text-white font-bold text-sm">{item.name}</p>
                                                        <p className="text-slate-500 text-[10px] uppercase">{item.quantity} units sold</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-yellow-400 font-black text-md font-mono">{formatCurrency(item.revenue)}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </CardContent>
                        </Card>

                        {/* Consumption Insights - Now Ingredient Usage Tally */}
                        <Card className="bg-slate-900/50 border-slate-800">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-white text-lg flex items-center gap-2">
                                    <PieChart className="h-5 w-5 text-purple-400" />
                                    Ingredient Usage Tally
                                </CardTitle>
                                <CardDescription>Total consumption for {reportDays} day period</CardDescription>
                            </CardHeader>
                            <CardContent className="px-0">
                                <ScrollArea className="h-[350px]">
                                    <div className="px-6 space-y-3 pb-10">
                                        {consumptionTrends && Object.entries(consumptionTrends).map(([name, data]: [string, any]) => {
                                            const total = Object.values(data).reduce((a: any, b: any) => a + b, 0) as number;
                                            return (
                                                <div key={name} className="p-3 rounded-lg bg-slate-950 border border-slate-800/50 flex items-center justify-between">
                                                    <div className="flex-1">
                                                        <span className="text-white font-bold text-xs block">{name}</span>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <div className="h-1.5 flex-1 bg-slate-900 rounded-full overflow-hidden">
                                                                <div className="h-full bg-purple-600 rounded-full" style={{ width: '60%' }} />
                                                            </div>
                                                            <span className="text-[10px] text-slate-500 w-12 text-right">High usage</span>
                                                        </div>
                                                    </div>
                                                    <div className="ml-4 text-right">
                                                        <span className="text-purple-400 font-mono font-bold text-sm block">{total.toFixed(0)}</span>
                                                        <span className="text-[10px] text-slate-600 uppercase">Units</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {(!consumptionTrends || Object.keys(consumptionTrends).length === 0) && (
                                            <div className="text-center text-slate-500 py-10">
                                                No consumption data to tally
                                            </div>
                                        )}
                                    </div>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>

            {/* Bottom Info Bar */}
            <div className="fixed bottom-0 left-0 right-0 bg-slate-950/80 border-t border-slate-800/50 backdrop-blur-xl p-3 flex items-center justify-center gap-8 z-50">
                <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">PostgreSQL Online</span>
                </div>
                <div className="flex items-center gap-2">
                    <Activity className="h-3 w-3 text-purple-400" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sync Polling: 30s</span>
                </div>
                <div className="hidden md:flex items-center gap-2 text-slate-500">
                    <Info className="h-3 w-3" />
                    <span className="text-[10px] font-bold italic">PowerDash v2.1 • Multi-Role Operational Schema</span>
                </div>
            </div>
        </div>
    );
}
