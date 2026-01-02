import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    RefreshCw, TrendingUp, TrendingDown, DollarSign, Package,
    AlertTriangle, Clock, ShoppingCart, Zap, BarChart3,
    ArrowUpRight, ArrowDownRight, Activity
} from 'lucide-react';

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

export default function PowerDashboard() {
    const [refreshKey, setRefreshKey] = useState(0);

    // Live transactions (last 20)
    const { data: transactions = [], isLoading: txLoading } = useQuery<Transaction[]>({
        queryKey: ['op-transactions', refreshKey],
        queryFn: async () => {
            const res = await fetch('/api/op/transactions?limit=20');
            return res.json();
        },
        refetchInterval: 30000, // Auto-refresh every 30 seconds
    });

    // Today's transaction summary
    const { data: todaySummary } = useQuery({
        queryKey: ['op-transactions-summary', refreshKey],
        queryFn: async () => {
            const res = await fetch('/api/op/transactions/summary');
            return res.json();
        },
        refetchInterval: 60000,
    });

    // Today's consumption
    const { data: consumption = [] } = useQuery<ConsumptionItem[]>({
        queryKey: ['op-consumption', refreshKey],
        queryFn: async () => {
            const today = new Date().toISOString().split('T')[0];
            const res = await fetch(`/api/op/consumption?from=${today}&to=${today}`);
            return res.json();
        },
        refetchInterval: 60000,
    });

    // Stock levels
    const { data: stock = [] } = useQuery<StockItem[]>({
        queryKey: ['op-stock', refreshKey],
        queryFn: async () => {
            const res = await fetch('/api/op/ingredients/stock');
            return res.json();
        },
        refetchInterval: 120000,
    });

    // Sync status
    const { data: syncStatus } = useQuery<SyncStatus>({
        queryKey: ['op-sync-status', refreshKey],
        queryFn: async () => {
            const res = await fetch('/api/op/sync/status');
            return res.json();
        },
        refetchInterval: 60000,
    });

    // Pending reorders
    const { data: pendingReorders = [] } = useQuery({
        queryKey: ['op-reorders-pending', refreshKey],
        queryFn: async () => {
            const res = await fetch('/api/op/reorders/pending');
            if (!res.ok) return [];
            return res.json();
        },
        refetchInterval: 120000,
    });

    const handleRefresh = () => setRefreshKey(k => k + 1);

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount);
    };

    // Calculate low stock items
    const lowStockItems = stock.filter(item =>
        item.shop_stock < 1000 && item.total_consumed > 0
    ).slice(0, 5);

    // Top consumed today
    const topConsumed = [...consumption]
        .sort((a, b) => b.total_consumed - a.total_consumed)
        .slice(0, 8);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 md:p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                        <Zap className="h-8 w-8 text-yellow-400" />
                        Power Dashboard
                    </h1>
                    <p className="text-purple-200 mt-1">Real-time operational intelligence</p>
                </div>
                <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-green-400 border-green-400">
                        <Activity className="h-3 w-3 mr-1 animate-pulse" />
                        LIVE
                    </Badge>
                    <Button onClick={handleRefresh} variant="outline" size="sm" className="text-white border-white/30">
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* KPI Cards Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <Card className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border-emerald-500/30">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-emerald-200 text-sm">Today's Sales</p>
                                <p className="text-2xl font-bold text-white">
                                    {formatCurrency(todaySummary?.totalSales || 0)}
                                </p>
                            </div>
                            <DollarSign className="h-10 w-10 text-emerald-400 opacity-60" />
                        </div>
                        <p className="text-emerald-300 text-xs mt-2">
                            {todaySummary?.transactionCount || 0} transactions
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-blue-500/30">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-blue-200 text-sm">Cash Sales</p>
                                <p className="text-2xl font-bold text-white">
                                    {formatCurrency(todaySummary?.cashSales || 0)}
                                </p>
                            </div>
                            <ShoppingCart className="h-10 w-10 text-blue-400 opacity-60" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border-purple-500/30">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-purple-200 text-sm">Card Sales</p>
                                <p className="text-2xl font-bold text-white">
                                    {formatCurrency(todaySummary?.cardSales || 0)}
                                </p>
                            </div>
                            <BarChart3 className="h-10 w-10 text-purple-400 opacity-60" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-amber-500/20 to-amber-600/10 border-amber-500/30">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-amber-200 text-sm">Pending Reorders</p>
                                <p className="text-2xl font-bold text-white">
                                    {pendingReorders?.length || 0}
                                </p>
                            </div>
                            <Package className="h-10 w-10 text-amber-400 opacity-60" />
                        </div>
                        {pendingReorders?.length > 0 && (
                            <Badge className="mt-2 bg-amber-500/30 text-amber-200">
                                Needs attention
                            </Badge>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Live Transaction Feed */}
                <Card className="lg:col-span-2 bg-slate-800/50 border-slate-700">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-white flex items-center gap-2">
                                <Activity className="h-5 w-5 text-green-400 animate-pulse" />
                                Live Transaction Feed
                            </CardTitle>
                            <Badge variant="outline" className="text-slate-300">
                                Auto-updates every 30s
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2 max-h-[400px] overflow-y-auto">
                            {txLoading ? (
                                <div className="text-slate-400 text-center py-8">Loading transactions...</div>
                            ) : transactions.length === 0 ? (
                                <div className="text-slate-400 text-center py-8">No transactions yet today</div>
                            ) : (
                                transactions.map((tx, idx) => (
                                    <div
                                        key={tx.id}
                                        className={`flex items-center justify-between p-3 rounded-lg ${idx === 0 ? 'bg-green-500/20 border border-green-500/30' : 'bg-slate-700/50'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-full ${tx.pay_type === 'cash' ? 'bg-green-500/20' :
                                                    tx.pay_type === 'card' ? 'bg-blue-500/20' : 'bg-purple-500/20'
                                                }`}>
                                                <DollarSign className={`h-4 w-4 ${tx.pay_type === 'cash' ? 'text-green-400' :
                                                        tx.pay_type === 'card' ? 'text-blue-400' : 'text-purple-400'
                                                    }`} />
                                            </div>
                                            <div>
                                                <p className="text-white font-medium">
                                                    {formatCurrency(tx.total_amount)}
                                                </p>
                                                <p className="text-slate-400 text-xs">
                                                    {tx.products?.length || 0} items • #{tx.poster_transaction_id?.slice(-6)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <Badge variant="outline" className={`text-xs ${tx.pay_type === 'cash' ? 'border-green-500 text-green-400' :
                                                    tx.pay_type === 'card' ? 'border-blue-500 text-blue-400' : 'border-purple-500 text-purple-400'
                                                }`}>
                                                {tx.pay_type?.toUpperCase() || 'MIXED'}
                                            </Badge>
                                            <p className="text-slate-400 text-xs mt-1">
                                                {formatTime(tx.transaction_date)}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Right Sidebar */}
                <div className="space-y-6">

                    {/* Sync Status */}
                    <Card className="bg-slate-800/50 border-slate-700">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-white text-sm flex items-center gap-2">
                                <RefreshCw className="h-4 w-4" />
                                Sync Status
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-400">Last sync:</span>
                                <span className="text-white">
                                    {syncStatus?.transactions?.lastSyncAt
                                        ? formatTime(syncStatus.transactions.lastSyncAt)
                                        : 'Never'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-400">Status:</span>
                                <Badge className={
                                    syncStatus?.transactions?.status === 'idle'
                                        ? 'bg-green-500/20 text-green-400'
                                        : 'bg-yellow-500/20 text-yellow-400'
                                }>
                                    {syncStatus?.transactions?.status || 'Unknown'}
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Low Stock Alerts */}
                    <Card className="bg-slate-800/50 border-slate-700">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-white text-sm flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-amber-400" />
                                Low Stock Alerts
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {lowStockItems.length === 0 ? (
                                <p className="text-slate-400 text-sm">All stock levels OK</p>
                            ) : (
                                <div className="space-y-2">
                                    {lowStockItems.map(item => (
                                        <div key={item.id} className="flex items-center justify-between p-2 bg-amber-500/10 rounded">
                                            <span className="text-white text-sm">{item.name}</span>
                                            <span className="text-amber-400 text-sm font-medium">
                                                {item.shop_stock.toFixed(0)} {item.unit}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Pending Reorders */}
                    {pendingReorders?.length > 0 && (
                        <Card className="bg-slate-800/50 border-amber-500/30">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-white text-sm flex items-center gap-2">
                                    <Package className="h-4 w-4 text-amber-400" />
                                    Pending Reorders ({pendingReorders.length})
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {pendingReorders.slice(0, 3).map((req: any) => (
                                        <div key={req.id} className="flex items-center justify-between p-2 bg-slate-700/50 rounded">
                                            <span className="text-white text-sm">{req.ingredient_name}</span>
                                            <Badge className={
                                                req.priority === 'urgent' ? 'bg-red-500/30 text-red-400' :
                                                    req.priority === 'high' ? 'bg-orange-500/30 text-orange-400' :
                                                        'bg-slate-500/30 text-slate-300'
                                            }>
                                                {req.priority}
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            {/* Consumption Analysis Section */}
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Top Ingredients Used Today */}
                <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-cyan-400" />
                            Top Ingredients Used Today
                        </CardTitle>
                        <CardDescription className="text-slate-400">
                            Based on {todaySummary?.transactionCount || 0} transactions
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {topConsumed.length === 0 ? (
                                <p className="text-slate-400 text-center py-4">No consumption data yet</p>
                            ) : (
                                topConsumed.map((item, idx) => {
                                    const maxConsumption = topConsumed[0]?.total_consumed || 1;
                                    const percentage = (item.total_consumed / maxConsumption) * 100;

                                    return (
                                        <div key={item.ingredient_id} className="space-y-1">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-white">{item.ingredient_name}</span>
                                                <span className="text-cyan-400 font-medium">
                                                    {item.total_consumed.toFixed(1)} {item.unit}
                                                </span>
                                            </div>
                                            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all"
                                                    style={{ width: `${percentage}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Shop Stock Overview */}
                <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                            <Package className="h-5 w-5 text-purple-400" />
                            Shop Stock Overview
                        </CardTitle>
                        <CardDescription className="text-slate-400">
                            Current inventory levels at shop
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2 max-h-[250px] overflow-y-auto">
                            {stock.length === 0 ? (
                                <p className="text-slate-400 text-center py-4">No stock data available</p>
                            ) : (
                                stock.filter(s => s.shop_stock > 0).slice(0, 10).map(item => (
                                    <div key={item.id} className="flex items-center justify-between p-2 bg-slate-700/30 rounded">
                                        <span className="text-white text-sm">{item.name}</span>
                                        <div className="flex items-center gap-3">
                                            <Badge variant="outline" className={`text-xs ${item.shop_stock < 500 ? 'border-red-500 text-red-400' :
                                                    item.shop_stock < 2000 ? 'border-amber-500 text-amber-400' :
                                                        'border-green-500 text-green-400'
                                                }`}>
                                                {item.shop_stock.toFixed(0)} {item.unit}
                                            </Badge>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Footer Stats */}
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-slate-800/30 border-slate-700/50">
                    <CardContent className="p-4 text-center">
                        <p className="text-slate-400 text-sm">Ingredients Tracked</p>
                        <p className="text-2xl font-bold text-white">{stock.length}</p>
                    </CardContent>
                </Card>
                <Card className="bg-slate-800/30 border-slate-700/50">
                    <CardContent className="p-4 text-center">
                        <p className="text-slate-400 text-sm">Today's Consumption Items</p>
                        <p className="text-2xl font-bold text-white">{consumption.length}</p>
                    </CardContent>
                </Card>
                <Card className="bg-slate-800/30 border-slate-700/50">
                    <CardContent className="p-4 text-center">
                        <p className="text-slate-400 text-sm">Low Stock Items</p>
                        <p className="text-2xl font-bold text-amber-400">{lowStockItems.length}</p>
                    </CardContent>
                </Card>
                <Card className="bg-slate-800/30 border-slate-700/50">
                    <CardContent className="p-4 text-center">
                        <p className="text-slate-400 text-sm">Avg Sale Value</p>
                        <p className="text-2xl font-bold text-white">
                            {formatCurrency((todaySummary?.totalSales || 0) / Math.max(todaySummary?.transactionCount || 1, 1))}
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
