import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import {
    ArrowLeft,
    Package,
    Search,
    AlertTriangle,
    RefreshCw,
    Warehouse
} from "lucide-react";
import { Link } from "wouter";

interface StockItem {
    id: string;
    name: string;
    category: string;
    unit: string;
    current_stock: number;
    min_stock: number;
}

export default function StoreStock() {
    const [searchQuery, setSearchQuery] = useState("");

    // Fetch store stock from PosterPOS
    const { data: stockItems = [], isLoading, refetch } = useQuery<StockItem[]>({
        queryKey: ["/api/posterpos/ingredients"],
        queryFn: async () => {
            const res = await fetch("/api/posterpos/ingredients");
            if (!res.ok) return [];
            const data = await res.json();
            // Transform PosterPOS data to our format
            return data.map((item: any) => ({
                id: String(item.ingredient_id),
                name: item.ingredient_name,
                category: "ingredients",
                unit: item.ingredient_unit,
                current_stock: parseFloat(item.ingredient_left) || 0,
                min_stock: 0, // POS doesn't have min stock
            }));
        },
    });

    const filteredItems = stockItems.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const lowStockItems = filteredItems.filter(item => item.current_stock <= 0);
    const inStockItems = filteredItems.filter(item => item.current_stock > 0);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <Link href="/store">
                        <Button variant="ghost" className="text-slate-400 hover:text-white mb-4">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Store
                        </Button>
                    </Link>
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-white mb-2">Current Stock</h1>
                            <p className="text-slate-400">View-only stock levels from PosterPOS</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button
                                variant="outline"
                                className="border-slate-600 text-slate-300"
                                onClick={() => refetch()}
                            >
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Refresh
                            </Button>
                            <div className="h-12 w-12 rounded-full bg-cyan-600 flex items-center justify-center">
                                <Warehouse className="h-6 w-6 text-white" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <Card className="bg-slate-800/50 border-slate-700">
                        <CardContent className="pt-6 text-center">
                            <p className="text-3xl font-bold text-white">{stockItems.length}</p>
                            <p className="text-sm text-slate-400">Total Items</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-emerald-900/30 border-emerald-700">
                        <CardContent className="pt-6 text-center">
                            <p className="text-3xl font-bold text-emerald-400">{inStockItems.length}</p>
                            <p className="text-sm text-slate-400">In Stock</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-red-900/30 border-red-700">
                        <CardContent className="pt-6 text-center">
                            <p className="text-3xl font-bold text-red-400">{lowStockItems.length}</p>
                            <p className="text-sm text-slate-400">Out of Stock</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Search */}
                <div className="relative mb-6">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search stock..."
                        className="pl-10 bg-slate-800 border-slate-600 text-white"
                    />
                </div>

                {/* Stock List */}
                {isLoading ? (
                    <div className="text-center py-12">
                        <p className="text-slate-400">Loading stock levels...</p>
                    </div>
                ) : filteredItems.length === 0 ? (
                    <Card className="bg-slate-800/30 border-slate-700">
                        <CardContent className="py-12 text-center">
                            <Package className="h-16 w-16 text-slate-600 mx-auto mb-4" />
                            <h2 className="text-xl font-bold text-white mb-2">No Stock Data</h2>
                            <p className="text-slate-400">No items found from PosterPOS</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-3">
                        {/* Out of stock warning */}
                        {lowStockItems.length > 0 && (
                            <Card className="bg-red-900/20 border-red-700 mb-4">
                                <CardContent className="py-3">
                                    <div className="flex items-center gap-2">
                                        <AlertTriangle className="h-5 w-5 text-red-400" />
                                        <span className="text-red-200">
                                            {lowStockItems.length} items are out of stock
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {filteredItems.map((item) => (
                            <Card
                                key={item.id}
                                className={`border-slate-700 transition-all ${item.current_stock <= 0
                                        ? "bg-red-900/20 border-red-800"
                                        : "bg-slate-800/50 hover:border-slate-600"
                                    }`}
                            >
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${item.current_stock <= 0
                                                    ? "bg-red-900/40 border border-red-700/50"
                                                    : "bg-cyan-900/40 border border-cyan-700/50"
                                                }`}>
                                                <Package className={`h-5 w-5 ${item.current_stock <= 0 ? "text-red-400" : "text-cyan-400"
                                                    }`} />
                                            </div>
                                            <div>
                                                <h3 className="font-medium text-white">{item.name}</h3>
                                                <p className="text-sm text-slate-400">{item.unit}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-2xl font-bold ${item.current_stock <= 0 ? "text-red-400" : "text-emerald-400"
                                                }`}>
                                                {item.current_stock.toFixed(1)}
                                            </p>
                                            <Badge
                                                variant="outline"
                                                className={item.current_stock <= 0
                                                    ? "border-red-600 text-red-400"
                                                    : "border-emerald-600 text-emerald-400"
                                                }
                                            >
                                                {item.current_stock <= 0 ? "Out of Stock" : "In Stock"}
                                            </Badge>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
