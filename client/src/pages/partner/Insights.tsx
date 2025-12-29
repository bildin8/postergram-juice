import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
    ArrowLeft,
    TrendingUp,
    ShoppingCart,
    Clock,
    AlertTriangle,
    Package,
    DollarSign,
    BarChart3,
    ChevronDown,
    ChevronUp,
    Plus,
    Calendar,
    Filter,
    FileJson,
    Save as SaveIcon
} from "lucide-react";
import { Link } from "wouter";

interface SalesSummary {
    totalRevenue: number;
    avgDailyRevenue: number;
    avgTransactionValue: number;
    transactionCount: number;
    paymentSplit: {
        cash: number;
        card: number;
        cashPercent: number;
    };
}

interface VelocityItem {
    ingredientId: string;
    name: string;
    currentStock: number;
    avgDailyConsumption: number;
    daysRemaining: number;
    urgency: string;
}

interface PARSuggestion {
    ingredientId: string;
    name: string;
    currentStock: number;
    stats: {
        totalUsed: number;
        avgDailyUsage: number;
    };
    suggestion: {
        suggestedPAR: number;
        orderQty: number;
    };
}

export default function Insights() {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Date range state
    const [days, setDays] = useState(30);

    // Expanded sections state
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

    // Selected items for reorder
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

    // Fetch sales insights
    const { data: sales, isLoading: salesLoading } = useQuery<{ summary: SalesSummary; topProducts: any[] }>({
        queryKey: ["/api/insights/sales", days],
        queryFn: async () => {
            const res = await fetch(`/api/insights/sales?days=${days}`);
            return res.json();
        },
    });

    // Fetch velocity (urgent items)
    const { data: velocity } = useQuery<{ items: VelocityItem[]; alerts: { critical: number; warning: number } }>({
        queryKey: ["/api/insights/consumption-velocity", days],
        queryFn: async () => {
            const res = await fetch(`/api/insights/consumption-velocity?days=${days}`);
            return res.json();
        },
    });

    // Fetch PAR suggestions
    const { data: parData } = useQuery<{ suggestions: PARSuggestion[] }>({
        queryKey: ["/api/insights/par-suggestions", days],
        queryFn: async () => {
            const res = await fetch(`/api/insights/par-suggestions?days=${days}`);
            return res.json();
        },
    });

    // Fetch store insights
    const { data: storeInsights } = useQuery({
        queryKey: ["/api/insights/store", days],
        queryFn: async () => {
            const res = await fetch(`/api/insights/store?days=${days}`);
            return res.json();
        },
    });

    // Fetch reorder templates
    const { data: templates = [], refetch: refetchTemplates } = useQuery({
        queryKey: ["/api/partner/reorder-templates"],
        queryFn: async () => {
            const res = await fetch("/api/partner/reorder-templates");
            return res.json();
        },
    });

    const [templateName, setTemplateName] = useState("");
    const [showTemplateSave, setShowTemplateSave] = useState(false);

    // Save template mutation
    const saveTemplateMutation = useMutation({
        mutationFn: async () => {
            const items = parData?.suggestions
                ?.filter(s => selectedItems.has(s.ingredientId))
                .map(s => ({
                    storeItemId: undefined, // Could link if we had mapping
                    itemName: s.name,
                    quantity: Math.ceil(s.suggestion.orderQty),
                    unit: "units"
                })) || [];

            if (items.length === 0) throw new Error("No items selected");

            const res = await fetch("/api/partner/reorder-templates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: templateName,
                    items,
                    createdBy: "Partner"
                }),
            });
            if (!res.ok) throw new Error("Failed to save template");
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Template Saved", description: `"${templateName}" is now available for quick reuse.` });
            setShowTemplateSave(false);
            setTemplateName("");
            refetchTemplates();
        },
        onError: (err: any) => {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        }
    });

    // Create reorder request mutation
    const createReorderMutation = useMutation({
        mutationFn: async (items: { name: string; quantity: number }[]) => {
            const res = await fetch("/api/store-portal/purchase-requests", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    requestedBy: "Partner (from Insights)",
                    items: items.map(item => ({
                        itemName: item.name,
                        requestedQty: item.quantity,
                        unit: "units",
                        notes: "Auto-generated from PAR suggestion",
                    })),
                    notes: `PAR-based reorder from ${days}-day analysis`,
                }),
            });
            if (!res.ok) throw new Error("Failed to create reorder");
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Reorder Created", description: "Purchase request submitted for approval." });
            setSelectedItems(new Set());
        },
        onError: () => {
            toast({ title: "Error", description: "Failed to create reorder request", variant: "destructive" });
        },
    });

    const applyTemplate = (templateId: string) => {
        const template = templates.find((t: any) => t.id === templateId);
        if (!template) return;

        // Apply quantities to selected items
        // For simplicity, we just select the items that are in the template
        // Note: names match exactly
        const templateItemNames = new Set(template.items.map((i: any) => i.item_name));
        const newSelected = new Set(selectedItems);

        parData?.suggestions?.forEach(s => {
            if (templateItemNames.has(s.name)) {
                newSelected.add(s.ingredientId);
            }
        });

        setSelectedItems(newSelected);
        toast({ title: "Template Applied", description: `Selected items from "${template.name}"` });
    };

    const toggleSection = (section: string) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const toggleItemSelection = (itemId: string) => {
        const newSelected = new Set(selectedItems);
        if (newSelected.has(itemId)) {
            newSelected.delete(itemId);
        } else {
            newSelected.add(itemId);
        }
        setSelectedItems(newSelected);
    };

    const selectAllPARItems = () => {
        const itemsNeedingOrder = parData?.suggestions?.filter(s => s.suggestion.orderQty > 0) || [];
        if (selectedItems.size === itemsNeedingOrder.length) {
            setSelectedItems(new Set());
        } else {
            setSelectedItems(new Set(itemsNeedingOrder.map(s => s.ingredientId)));
        }
    };

    const handleCreateReorder = () => {
        const items = parData?.suggestions
            ?.filter(s => selectedItems.has(s.ingredientId))
            .map(s => ({ name: s.name, quantity: Math.ceil(s.suggestion.orderQty) })) || [];

        if (items.length > 0) {
            createReorderMutation.mutate(items);
        }
    };

    const urgentItems = velocity?.items?.filter(i => i.urgency === 'critical' || i.urgency === 'warning') || [];
    const parItemsNeedingOrder = parData?.suggestions?.filter(s => s.suggestion.orderQty > 0) || [];

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-900 p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <Link href="/partner">
                        <Button variant="ghost" className="text-slate-400 hover:text-white mb-4">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Partner
                        </Button>
                    </Link>
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-white mb-2">Business Insights</h1>
                            <p className="text-slate-400">Data-driven analytics from your PosterPOS history</p>
                        </div>

                        {/* Date Range Filter */}
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-slate-400" />
                                <Label className="text-slate-400">Period:</Label>
                            </div>
                            <Select value={days.toString()} onValueChange={(v) => setDays(parseInt(v))}>
                                <SelectTrigger className="w-36 bg-slate-800 border-slate-600 text-white">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1">Today</SelectItem>
                                    <SelectItem value="7">Last 7 days</SelectItem>
                                    <SelectItem value="14">Last 14 days</SelectItem>
                                    <SelectItem value="30">Last 30 days</SelectItem>
                                    <SelectItem value="60">Last 60 days</SelectItem>
                                    <SelectItem value="90">Last 90 days</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                {/* Templates Quick Actions */}
                {templates.length > 0 && (
                    <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                        {templates.map((t: any) => (
                            <Button
                                key={t.id}
                                variant="outline"
                                size="sm"
                                className="bg-slate-800/40 border-slate-700 text-slate-300 hover:bg-slate-700 whitespace-nowrap"
                                onClick={() => applyTemplate(t.id)}
                            >
                                <FileJson className="h-4 w-4 mr-2 text-indigo-400" />
                                {t.name}
                            </Button>
                        ))}
                    </div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <Card className="bg-slate-800/50 border-slate-700">
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <DollarSign className="h-8 w-8 text-emerald-500" />
                                <div>
                                    <p className="text-2xl font-bold text-white">
                                        {salesLoading ? "..." : `KES ${sales?.summary?.totalRevenue?.toLocaleString() || 0}`}
                                    </p>
                                    <p className="text-sm text-slate-400">{days === 1 ? "Today's" : `${days}-Day`} Revenue</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-slate-800/50 border-slate-700">
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <TrendingUp className="h-8 w-8 text-blue-500" />
                                <div>
                                    <p className="text-2xl font-bold text-white">
                                        {salesLoading ? "..." : `KES ${sales?.summary?.avgDailyRevenue?.toLocaleString() || 0}`}
                                    </p>
                                    <p className="text-sm text-slate-400">Avg Daily</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-slate-800/50 border-slate-700">
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <ShoppingCart className="h-8 w-8 text-purple-500" />
                                <div>
                                    <p className="text-2xl font-bold text-white">
                                        {salesLoading ? "..." : sales?.summary?.transactionCount?.toLocaleString() || 0}
                                    </p>
                                    <p className="text-sm text-slate-400">Transactions</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-slate-800/50 border-slate-700">
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <BarChart3 className="h-8 w-8 text-orange-500" />
                                <div>
                                    <p className="text-2xl font-bold text-white">
                                        {salesLoading ? "..." : `KES ${sales?.summary?.avgTransactionValue || 0}`}
                                    </p>
                                    <p className="text-sm text-slate-400">Avg Ticket</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Urgent Items - Running Low */}
                    <Card className="bg-slate-800/50 border-slate-700">
                        <CardHeader className="cursor-pointer" onClick={() => toggleSection('velocity')}>
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-white flex items-center gap-2">
                                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                                    Items Running Low
                                    {velocity?.alerts && (velocity.alerts.critical + velocity.alerts.warning) > 0 && (
                                        <Badge className="bg-amber-600 ml-2">
                                            {velocity.alerts.critical + velocity.alerts.warning}
                                        </Badge>
                                    )}
                                </CardTitle>
                                {urgentItems.length > 8 && (
                                    expandedSections['velocity'] ?
                                        <ChevronUp className="h-5 w-5 text-slate-400" /> :
                                        <ChevronDown className="h-5 w-5 text-slate-400" />
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            {urgentItems.length === 0 ? (
                                <p className="text-slate-400 text-center py-4">All stock levels healthy</p>
                            ) : (
                                <div className="space-y-3">
                                    {(expandedSections['velocity'] ? urgentItems : urgentItems.slice(0, 8)).map((item) => (
                                        <div
                                            key={item.ingredientId}
                                            className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50"
                                        >
                                            <div>
                                                <p className="text-white font-medium">{item.name}</p>
                                                <p className="text-sm text-slate-400">
                                                    {item.currentStock} in stock • {item.avgDailyConsumption}/day
                                                </p>
                                            </div>
                                            <Badge className={item.urgency === 'critical' ? 'bg-red-600' : 'bg-amber-600'}>
                                                {item.daysRemaining} days left
                                            </Badge>
                                        </div>
                                    ))}
                                    {urgentItems.length > 8 && !expandedSections['velocity'] && (
                                        <Button
                                            variant="ghost"
                                            className="w-full text-slate-400"
                                            onClick={() => toggleSection('velocity')}
                                        >
                                            View all {urgentItems.length} items
                                        </Button>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* PAR Suggestions - What to Order */}
                    <Card className="bg-slate-800/50 border-slate-700">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-white flex items-center gap-2">
                                    <Package className="h-5 w-5 text-blue-500" />
                                    Suggested Orders (PAR)
                                    {parItemsNeedingOrder.length > 0 && (
                                        <Badge className="bg-blue-600 ml-2">
                                            {parItemsNeedingOrder.length}
                                        </Badge>
                                    )}
                                </CardTitle>
                                {parItemsNeedingOrder.length > 0 && (
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="border-slate-600 text-slate-300"
                                            onClick={selectAllPARItems}
                                        >
                                            {selectedItems.size === parItemsNeedingOrder.length ? "Deselect All" : "Select All"}
                                        </Button>
                                        {selectedItems.size > 0 && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-indigo-400 hover:text-indigo-300"
                                                onClick={() => setShowTemplateSave(true)}
                                            >
                                                <SaveIcon className="h-4 w-4 mr-1" />
                                                Save Template
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            {showTemplateSave && (
                                <div className="mb-4 p-4 rounded-xl bg-indigo-900/20 border border-indigo-700/50 animate-in fade-in slide-in-from-top-2">
                                    <Label className="text-indigo-200 text-xs mb-2 block">SAVE AS TEMPLATE</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            value={templateName}
                                            onChange={(e) => setTemplateName(e.target.value)}
                                            placeholder="Template Name (e.g. Weekly Veggies)"
                                            className="bg-slate-900 border-indigo-700 text-white"
                                        />
                                        <Button
                                            className="bg-indigo-600 hover:bg-indigo-700"
                                            onClick={() => saveTemplateMutation.mutate()}
                                            disabled={!templateName || saveTemplateMutation.isPending}
                                        >
                                            Save
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            onClick={() => setShowTemplateSave(false)}
                                            className="text-slate-400"
                                        >
                                            Cancel
                                        </Button>
                                    </div>
                                </div>
                            )}
                            {!parItemsNeedingOrder.length ? (
                                <p className="text-slate-400 text-center py-4">No suggestions - stock levels OK</p>
                            ) : (
                                <>
                                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                                        {(expandedSections['par'] ? parItemsNeedingOrder : parItemsNeedingOrder.slice(0, 8)).map((item) => (
                                            <div
                                                key={item.ingredientId}
                                                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${selectedItems.has(item.ingredientId)
                                                    ? 'bg-blue-900/30 border border-blue-600'
                                                    : 'bg-slate-900/50'
                                                    }`}
                                            >
                                                <Checkbox
                                                    checked={selectedItems.has(item.ingredientId)}
                                                    onCheckedChange={() => toggleItemSelection(item.ingredientId)}
                                                    className="border-slate-500"
                                                />
                                                <div className="flex-1">
                                                    <p className="text-white font-medium">{item.name}</p>
                                                    <p className="text-sm text-slate-400">
                                                        Current: {item.currentStock} • Avg use: {item.stats.avgDailyUsage}/day
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <Badge className="bg-blue-600">
                                                        Order {Math.ceil(item.suggestion.orderQty)}
                                                    </Badge>
                                                    <p className="text-xs text-slate-500 mt-1">
                                                        PAR: {item.suggestion.suggestedPAR}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {parItemsNeedingOrder.length > 8 && !expandedSections['par'] && (
                                        <Button
                                            variant="ghost"
                                            className="w-full text-slate-400 mt-3"
                                            onClick={() => toggleSection('par')}
                                        >
                                            View all {parItemsNeedingOrder.length} items
                                        </Button>
                                    )}

                                    {/* Create Reorder Button */}
                                    {selectedItems.size > 0 && (
                                        <div className="mt-4 pt-4 border-t border-slate-700">
                                            <Button
                                                className="w-full bg-blue-600 hover:bg-blue-700"
                                                onClick={handleCreateReorder}
                                                disabled={createReorderMutation.isPending}
                                            >
                                                {createReorderMutation.isPending ? "Creating..." : (
                                                    <>
                                                        <Plus className="h-4 w-4 mr-2" />
                                                        Add {selectedItems.size} items to Reorder
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    )}
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* Top Products */}
                    <Card className="bg-slate-800/50 border-slate-700">
                        <CardHeader className="cursor-pointer" onClick={() => toggleSection('products')}>
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-white flex items-center gap-2">
                                    <TrendingUp className="h-5 w-5 text-emerald-500" />
                                    Top Selling Products
                                </CardTitle>
                                {(sales?.topProducts?.length || 0) > 8 && (
                                    expandedSections['products'] ?
                                        <ChevronUp className="h-5 w-5 text-slate-400" /> :
                                        <ChevronDown className="h-5 w-5 text-slate-400" />
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            {!sales?.topProducts?.length ? (
                                <p className="text-slate-400 text-center py-4">No sales data</p>
                            ) : (
                                <div className="space-y-3">
                                    {(expandedSections['products'] ? sales.topProducts : sales.topProducts.slice(0, 8)).map((product, idx) => (
                                        <div
                                            key={product.id}
                                            className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50"
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className="text-slate-500 font-mono w-6">#{idx + 1}</span>
                                                <div>
                                                    <p className="text-white font-medium">{product.name}</p>
                                                    <p className="text-sm text-slate-400">{product.qty} sold</p>
                                                </div>
                                            </div>
                                            <p className="text-emerald-400 font-medium">
                                                KES {product.revenue.toLocaleString()}
                                            </p>
                                        </div>
                                    ))}
                                    {(sales?.topProducts?.length || 0) > 8 && !expandedSections['products'] && (
                                        <Button
                                            variant="ghost"
                                            className="w-full text-slate-400"
                                            onClick={() => toggleSection('products')}
                                        >
                                            View all {sales?.topProducts?.length} products
                                        </Button>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Store Summary */}
                    <Card className="bg-slate-800/50 border-slate-700">
                        <CardHeader>
                            <CardTitle className="text-white flex items-center gap-2">
                                <Package className="h-5 w-5 text-purple-500" />
                                Store Operations ({days} Days)
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {!storeInsights?.hasData ? (
                                <div className="text-center py-8">
                                    <Clock className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                                    <p className="text-slate-400">No store data yet</p>
                                    <p className="text-sm text-slate-500 mt-1">
                                        Start recording purchases and dispatches to see insights
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 rounded-lg bg-slate-900/50 text-center">
                                        <p className="text-2xl font-bold text-white">
                                            {storeInsights.summary?.totalPurchases || 0}
                                        </p>
                                        <p className="text-sm text-slate-400">Purchases</p>
                                    </div>
                                    <div className="p-4 rounded-lg bg-slate-900/50 text-center">
                                        <p className="text-2xl font-bold text-emerald-400">
                                            KES {storeInsights.summary?.totalPurchaseCost?.toLocaleString() || 0}
                                        </p>
                                        <p className="text-sm text-slate-400">Total Cost</p>
                                    </div>
                                    <div className="p-4 rounded-lg bg-slate-900/50 text-center">
                                        <p className="text-2xl font-bold text-white">
                                            {storeInsights.summary?.totalDispatches || 0}
                                        </p>
                                        <p className="text-sm text-slate-400">Dispatches</p>
                                    </div>
                                    <div className="p-4 rounded-lg bg-slate-900/50 text-center">
                                        <p className="text-2xl font-bold text-white">
                                            {storeInsights.summary?.totalProcessed || 0}
                                        </p>
                                        <p className="text-sm text-slate-400">Items Processed</p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Payment Split */}
                {sales?.summary?.paymentSplit && (
                    <Card className="mt-6 bg-slate-800/50 border-slate-700">
                        <CardHeader>
                            <CardTitle className="text-white">Payment Methods</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-4">
                                <div className="flex-1">
                                    <div className="flex justify-between mb-2">
                                        <span className="text-slate-400">Cash</span>
                                        <span className="text-white font-medium">
                                            KES {sales.summary.paymentSplit.cash.toLocaleString()} ({sales.summary.paymentSplit.cashPercent}%)
                                        </span>
                                    </div>
                                    <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-emerald-500 rounded-full transition-all"
                                            style={{ width: `${sales.summary.paymentSplit.cashPercent}%` }}
                                        />
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between mb-2">
                                        <span className="text-slate-400">Card/M-Pesa</span>
                                        <span className="text-white font-medium">
                                            KES {sales.summary.paymentSplit.card.toLocaleString()} ({100 - sales.summary.paymentSplit.cashPercent}%)
                                        </span>
                                    </div>
                                    <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-blue-500 rounded-full transition-all"
                                            style={{ width: `${100 - sales.summary.paymentSplit.cashPercent}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
