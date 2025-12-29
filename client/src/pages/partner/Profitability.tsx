import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Link } from "wouter";
import { ArrowLeft, TrendingUp, TrendingDown, DollarSign, Search, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";

interface RecipeIngredient {
    name: string;
    qty: number;
    unit: string;
    costPerUnit: number;
    lineCost: number;
}

interface ProductProfitability {
    id: number;
    name: string;
    category: string;
    price: number;
    cost: number;
    margin: number;
    marginPercent: number;
    recipe: RecipeIngredient[];
}

export default function Profitability() {
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [showLowMarginOnly, setShowLowMarginOnly] = useState(false);

    const { data: products, isLoading } = useQuery<ProductProfitability[]>({
        queryKey: ["/api/partner/profitability"],
        queryFn: async () => {
            const res = await fetch("/api/partner/profitability", {
                headers: { "x-app-pin": localStorage.getItem("app_pin") || "" } // Security
            });
            if (!res.ok) throw new Error("Failed to fetch profitability data");
            return res.json();
        },
    });

    const filteredProducts = products?.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.category.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesFilter = showLowMarginOnly ? p.marginPercent < 40 : true; // Warning threshold
        return matchesSearch && matchesFilter;
    });

    const toggleExpand = (id: number) => {
        setExpandedId(expandedId === id ? null : id);
    };

    const avgMargin = products
        ? products.reduce((sum, p) => sum + p.marginPercent, 0) / products.length
        : 0;

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
                    <div className="flex justify-between items-end">
                        <div>
                            <h1 className="text-3xl font-bold text-white mb-2">Profitability Engine</h1>
                            <p className="text-slate-400">Analyze margins, recipe costs, and pricing strategy.</p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-slate-400">Average Margin</p>
                            <p className={`text-2xl font-bold ${avgMargin >= 50 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {avgMargin.toFixed(1)}%
                            </p>
                        </div>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex flex-col md:flex-row gap-4 mb-6 items-center bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                        <Input
                            placeholder="Search products..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 bg-slate-900 border-slate-600 text-white"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Switch
                            id="low-margin"
                            checked={showLowMarginOnly}
                            onCheckedChange={setShowLowMarginOnly}
                        />
                        <label htmlFor="low-margin" className="text-slate-300 text-sm cursor-pointer select-none">
                            Show Low Margin Only (&lt; 40%)
                        </label>
                    </div>
                </div>

                {/* List */}
                {isLoading ? (
                    <div className="text-center py-20 text-slate-500">Loading Profitability Data...</div>
                ) : (filteredProducts?.length === 0) ? (
                    <div className="text-center py-20 text-slate-500">No products found.</div>
                ) : (
                    <div className="space-y-4">
                        {filteredProducts?.map((product) => (
                            <Card key={product.id} className="bg-slate-800/30 border-slate-700 hover:bg-slate-800/50 transition-colors">
                                <CardContent className="p-0">
                                    <div
                                        className="flex flex-col md:flex-row items-center p-4 cursor-pointer gap-4"
                                        onClick={() => toggleExpand(product.id)}
                                    >
                                        {/* Main Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="text-lg font-bold text-white truncate">{product.name}</h3>
                                                <Badge variant="outline" className="text-slate-400 border-slate-600 text-[10px]">
                                                    {product.category}
                                                </Badge>
                                            </div>
                                            <div className="flex gap-4 text-sm text-slate-400">
                                                <span>Price: <span className="text-white">KES {product.price.toLocaleString()}</span></span>
                                                <span>Cost: <span className="text-white">KES {product.cost.toLocaleString()}</span></span>
                                            </div>
                                        </div>

                                        {/* Margin Viz */}
                                        <div className="flex items-center gap-6 w-full md:w-auto mt-4 md:mt-0 justify-between">
                                            <div className="text-right">
                                                <p className="text-xs text-slate-500 uppercase font-bold">Profit</p>
                                                <p className="text-lg font-bold text-white">KES {product.margin.toLocaleString()}</p>
                                            </div>

                                            <div className="w-24 text-right">
                                                <div className={`inline-flex items-center px-2 py-1 rounded-md ${product.marginPercent < 30 ? 'bg-red-900/30 text-red-400 border border-red-800' :
                                                    product.marginPercent < 50 ? 'bg-amber-900/30 text-amber-400 border border-amber-800' :
                                                        'bg-emerald-900/30 text-emerald-400 border border-emerald-800'
                                                    }`}>
                                                    <span className="font-bold">{product.marginPercent.toFixed(1)}%</span>
                                                </div>
                                            </div>

                                            {expandedId === product.id ? <ChevronUp className="text-slate-500" /> : <ChevronDown className="text-slate-500" />}
                                        </div>
                                    </div>

                                    {/* Expanded Details */}
                                    {expandedId === product.id && (
                                        <div className="border-t border-slate-700/50 bg-slate-900/30 p-4 md:p-6 animate-in slide-in-from-top-2">
                                            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Recipe Cost Breakdown</h4>

                                            {product.recipe.length === 0 ? (
                                                <div className="flex items-center gap-2 text-amber-500/80 bg-amber-900/10 p-3 rounded-lg border border-amber-900/20">
                                                    <AlertCircle className="h-4 w-4" />
                                                    <p className="text-sm">No recipe ingredients found for this product. Cost is calculated as 0.</p>
                                                </div>
                                            ) : (
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-sm item-table">
                                                        <thead>
                                                            <tr className="text-left text-slate-500 border-b border-slate-700">
                                                                <th className="pb-2 font-medium">Ingredient</th>
                                                                <th className="pb-2 text-right font-medium">Qty Used</th>
                                                                <th className="pb-2 text-right font-medium">Cost / Unit</th>
                                                                <th className="pb-2 text-right font-medium">Line Cost</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-800">
                                                            {product.recipe.map((ing, idx) => (
                                                                <tr key={idx} className="group hover:bg-slate-800/30">
                                                                    <td className="py-2 text-slate-300">{ing.name}</td>
                                                                    <td className="py-2 text-right text-slate-400">{ing.qty} {ing.unit}</td>
                                                                    <td className="py-2 text-right text-slate-400">KES {ing.costPerUnit.toFixed(2)}</td>
                                                                    <td className="py-2 text-right text-white font-medium">KES {ing.lineCost.toFixed(2)}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                        <tfoot>
                                                            <tr className="border-t border-slate-700">
                                                                <td colSpan={3} className="pt-3 text-right font-bold text-slate-400">Total Recipe Cost</td>
                                                                <td className="pt-3 text-right font-bold text-emerald-400">KES {product.cost.toLocaleString()}</td>
                                                            </tr>
                                                        </tfoot>
                                                    </table>
                                                </div>
                                            )}

                                            {/* Action Buttons */}
                                            {product.marginPercent < 40 && (
                                                <div className="mt-4 flex gap-2">
                                                    <Button size="sm" variant="outline" className="border-amber-600 text-amber-500 hover:bg-amber-900/20">
                                                        Request Price Increase
                                                    </Button>
                                                    <Button size="sm" variant="outline" className="border-slate-600 text-slate-400 hover:bg-slate-800">
                                                        Check Suppliers
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
