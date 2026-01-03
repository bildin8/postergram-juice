import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
    ArrowLeft,
    ShoppingCart,
    Check,
    Camera,
    Package,
    Sparkles,
    PlusCircle,
    Trash,
    List,
    AlertTriangle
} from "lucide-react";
import { Link } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

interface PRItem {
    id: string;
    item_name: string;
    requested_qty: number;
    approved_qty: number;
    unit: string;
    estimated_cost: number;
    // For execution
    receivedQty?: number;
    actualCost?: number;
}

interface PurchaseRequest {
    id: string;
    status: string;
    requested_by: string;
    requested_at: string;
    approved_by: string;
    approved_at: string;
    notes: string;
    total_estimated: number;
    items: PRItem[];
}

interface DraftItem {
    itemName: string;
    requestedQty: number;
    unit: string;
    estimatedCost?: number;
    notes?: string;
    isRecommendation?: boolean;
}

interface Recommendation {
    ingredient_id: string;
    name: string;
    current_stock: number;
    par_level: number;
    deficit: number;
    unit: string;
    last_cost: number;
}

export default function ToBuy() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [selectedPR, setSelectedPR] = useState<PurchaseRequest | null>(null);
    const [executionData, setExecutionData] = useState<Record<string, { receivedQty: number; actualCost: number }>>({});
    const [executedBy, setExecutedBy] = useState("");
    const [notes, setNotes] = useState("");

    // Create Request State
    const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
    const [requesterName, setRequesterName] = useState("");
    const [newItem, setNewItem] = useState<DraftItem>({ itemName: "", requestedQty: 0, unit: "units" });

    // Fetch approved PRs
    const { data: queue, isLoading: queueLoading } = useQuery<PurchaseRequest[]>({
        queryKey: ["/api/store/queue/to-buy"],
        queryFn: async () => {
            const res = await fetch("/api/store/queue/to-buy");
            return res.json();
        },
    });

    // Fetch recommendations (Smart Replenishment)
    const { data: recommendations = [] } = useQuery<Recommendation[]>({
        queryKey: ["/api/op/reports/below-par"],
        queryFn: async () => {
            const res = await fetch("/api/op/reports/below-par");
            if (!res.ok) return [];
            return res.json();
        },
    });

    // Create Request Mutation
    const createRequestMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/store/purchase-requests", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    requestedBy: requesterName,
                    items: draftItems,
                    notes: `Store Reorder${draftItems.some(i => i.isRecommendation) ? " (Smart Replenishment)" : ""}`,
                    priority: "normal"
                }),
            });

            if (!res.ok) throw new Error("Failed to create request");
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Request Sent", description: "Purchase request submitted for approval." });
            setDraftItems([]);
            setRequesterName("");
            queryClient.invalidateQueries({ queryKey: ["/api/store/queue/to-buy"] });
        },
        onError: () => {
            toast({ title: "Error", description: "Failed to submit request", variant: "destructive" });
        }
    });

    const addToDraft = (rec: Recommendation) => {
        if (draftItems.some(i => i.itemName === rec.name)) {
            toast({ title: "Already added", description: `${rec.name} is already in the list.` });
            return;
        }
        setDraftItems([...draftItems, {
            itemName: rec.name,
            requestedQty: rec.deficit,
            unit: rec.unit,
            estimatedCost: (rec.deficit * rec.last_cost),
            isRecommendation: true
        }]);
    };

    const addManualItem = () => {
        if (!newItem.itemName || newItem.requestedQty <= 0) return;
        setDraftItems([...draftItems, newItem]);
        setNewItem({ itemName: "", requestedQty: 0, unit: "units" });
    };

    const removeFromDraft = (index: number) => {
        const newItems = [...draftItems];
        newItems.splice(index, 1);
        setDraftItems(newItems);
    };

    // Execute purchase mutation
    const executeMutation = useMutation({
        mutationFn: async () => {
            if (!selectedPR) throw new Error("No PR selected");

            const items = selectedPR.items.map(item => ({
                prItemId: item.id,
                receivedQty: executionData[item.id]?.receivedQty || 0,
                actualCost: executionData[item.id]?.actualCost || 0,
            }));

            const res = await fetch("/api/store/purchases/execute", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prId: selectedPR.id,
                    executedBy,
                    items,
                    notes,
                }),
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || "Failed to execute purchase");
            }

            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Purchase Completed", description: "Stock has been updated." });
            queryClient.invalidateQueries({ queryKey: ["/api/store/queue/to-buy"] });
            setSelectedPR(null);
            setExecutionData({});
            setExecutedBy("");
            setNotes("");
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });

    const handleItemChange = (itemId: string, field: "receivedQty" | "actualCost", value: number) => {
        setExecutionData(prev => ({
            ...prev,
            [itemId]: {
                ...prev[itemId],
                [field]: value,
            },
        }));
    };

    const initializeExecution = (pr: PurchaseRequest) => {
        setSelectedPR(pr);
        // Pre-fill with approved quantities
        const initial: Record<string, { receivedQty: number; actualCost: number }> = {};
        for (const item of pr.items) {
            initial[item.id] = {
                receivedQty: item.approved_qty || item.requested_qty,
                actualCost: item.estimated_cost || 0,
            };
        }
        setExecutionData(initial);
    };

    const calculateTotal = () => {
        return Object.values(executionData).reduce((sum, item) => sum + (item.actualCost || 0), 0);
    };

    if (selectedPR) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
                <div className="max-w-4xl mx-auto">
                    {/* Header */}
                    <div className="mb-6">
                        <Button
                            variant="ghost"
                            className="text-slate-400 hover:text-white mb-4"
                            onClick={() => setSelectedPR(null)}
                        >
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Queue
                        </Button>
                        <h1 className="text-2xl font-bold text-white mb-2">Execute Purchase</h1>
                        <p className="text-slate-400">
                            PR from {selectedPR.requested_by} • Approved by {selectedPR.approved_by}
                        </p>
                    </div>

                    {/* Items Entry */}
                    <Card className="bg-slate-800/50 border-slate-700 mb-6">
                        <CardHeader>
                            <CardTitle className="text-white flex items-center gap-2">
                                <Package className="h-5 w-5 text-blue-500" />
                                Items Received
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {selectedPR.items.map((item) => (
                                    <div
                                        key={item.id}
                                        className="p-4 rounded-lg bg-slate-900/50 border border-slate-700"
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <div>
                                                <p className="text-white font-medium">{item.item_name}</p>
                                                <p className="text-sm text-slate-400">
                                                    Approved: {item.approved_qty || item.requested_qty} {item.unit}
                                                </p>
                                            </div>
                                            <Badge className="bg-blue-600">
                                                Est: KES {item.estimated_cost?.toLocaleString() || "N/A"}
                                            </Badge>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-sm text-slate-400 block mb-1">
                                                    Qty Received
                                                </label>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={executionData[item.id]?.receivedQty || ""}
                                                    onChange={(e) => handleItemChange(item.id, "receivedQty", parseFloat(e.target.value) || 0)}
                                                    className="bg-slate-800 border-slate-600 text-white"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-sm text-slate-400 block mb-1">
                                                    Actual Cost (KES)
                                                </label>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={executionData[item.id]?.actualCost || ""}
                                                    onChange={(e) => handleItemChange(item.id, "actualCost", parseFloat(e.target.value) || 0)}
                                                    className="bg-slate-800 border-slate-600 text-white"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Execution Details */}
                    <Card className="bg-slate-800/50 border-slate-700 mb-6">
                        <CardContent className="pt-6">
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="text-sm text-slate-400 block mb-1">Executed By *</label>
                                    <Input
                                        value={executedBy}
                                        onChange={(e) => setExecutedBy(e.target.value)}
                                        placeholder="Your name"
                                        className="bg-slate-900 border-slate-600 text-white"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm text-slate-400 block mb-1">Notes</label>
                                    <Input
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="Optional notes"
                                        className="bg-slate-900 border-slate-600 text-white"
                                    />
                                </div>
                            </div>

                            {/* Total */}
                            <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg mb-4">
                                <span className="text-slate-400">Total Actual Cost</span>
                                <span className="text-2xl font-bold text-emerald-400">
                                    KES {calculateTotal().toLocaleString()}
                                </span>
                            </div>

                            {/* Evidence Upload Placeholder */}
                            <Button variant="outline" className="w-full border-slate-600 text-slate-400 mb-4">
                                <Camera className="h-4 w-4 mr-2" />
                                Attach Receipt Photo (Optional)
                            </Button>

                            {/* Submit */}
                            <Button
                                className="w-full bg-emerald-600 hover:bg-emerald-700"
                                disabled={!executedBy || executeMutation.isPending}
                                onClick={() => executeMutation.mutate()}
                            >
                                {executeMutation.isPending ? "Processing..." : (
                                    <>
                                        <Check className="h-4 w-4 mr-2" />
                                        Complete Purchase
                                    </>
                                )}
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <Link href="/store">
                        <Button variant="ghost" className="text-slate-400 hover:text-white mb-4">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Store
                        </Button>
                    </Link>
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-bold text-white mb-2">Purchase Management</h1>
                            <p className="text-slate-400">Manage reorders and execute approved purchases</p>
                        </div>
                    </div>
                </div>

                <Tabs defaultValue="queue" className="space-y-6">
                    <TabsList className="bg-slate-800/50 p-1 border border-slate-700/50">
                        <TabsTrigger value="queue" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                            <ShoppingCart className="h-4 w-4 mr-2" />
                            To Buy Queue ({queue?.length || 0})
                        </TabsTrigger>
                        <TabsTrigger value="create" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                            <Sparkles className="h-4 w-4 mr-2" />
                            Create Request
                        </TabsTrigger>
                    </TabsList>

                    {/* ===================================================================================== */}
                    {/* TAB 1: EXECUTION QUEUE                                                              */}
                    {/* ===================================================================================== */}
                    <TabsContent value="queue">
                        {/* Loading */}
                        {queueLoading && (
                            <div className="text-center py-12">
                                <p className="text-slate-400">Loading...</p>
                            </div>
                        )}

                        {/* Empty State */}
                        {!queueLoading && (!queue || queue.length === 0) && (
                            <Card className="bg-slate-800/30 border-slate-700">
                                <CardContent className="py-12 text-center">
                                    <ShoppingCart className="h-16 w-16 text-slate-600 mx-auto mb-4" />
                                    <h2 className="text-xl font-bold text-white mb-2">No Pending Purchases</h2>
                                    <p className="text-slate-400">All approved PRs have been executed.</p>
                                </CardContent>
                            </Card>
                        )}

                        {/* Queue List */}
                        <div className="space-y-4">
                            {queue?.map((pr) => (
                                <Card
                                    key={pr.id}
                                    className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-all"
                                >
                                    <CardHeader className="pb-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-lg bg-blue-600">
                                                    <ShoppingCart className="h-5 w-5 text-white" />
                                                </div>
                                                <div>
                                                    <CardTitle className="text-white text-lg">
                                                        Purchase Request
                                                    </CardTitle>
                                                    <p className="text-sm text-slate-400">
                                                        by {pr.requested_by} • Approved {new Date(pr.approved_at).toLocaleDateString()}
                                                    </p>
                                                </div>
                                            </div>
                                            <Badge className="bg-emerald-600">
                                                {pr.items?.length || 0} items
                                            </Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        {/* Items Preview */}
                                        <div className="mb-4 p-3 rounded-lg bg-slate-900/50">
                                            <div className="flex flex-wrap gap-2">
                                                {pr.items?.slice(0, 5).map((item, idx) => (
                                                    <Badge key={idx} variant="outline" className="border-slate-600 text-slate-300">
                                                        {item.item_name} ({item.approved_qty || item.requested_qty})
                                                    </Badge>
                                                ))}
                                                {(pr.items?.length || 0) > 5 && (
                                                    <Badge variant="outline" className="border-slate-600 text-slate-500">
                                                        +{(pr.items?.length || 0) - 5} more
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>

                                        {/* Estimated Total */}
                                        <div className="flex items-center justify-between mb-4">
                                            <span className="text-slate-400">Estimated Total</span>
                                            <span className="text-lg font-bold text-white">
                                                KES {pr.total_estimated?.toLocaleString() || "N/A"}
                                            </span>
                                        </div>

                                        <Button
                                            className="w-full bg-blue-600 hover:bg-blue-700"
                                            onClick={() => initializeExecution(pr)}
                                        >
                                            Execute Purchase
                                        </Button>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </TabsContent>

                    {/* ===================================================================================== */}
                    {/* TAB 2: CREATE REQUEST (SMART REPLENISHMENT)                                         */}
                    {/* ===================================================================================== */}
                    <TabsContent value="create" className="space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Left: Recommendations */}
                            <div className="lg:col-span-2 space-y-6">
                                <Card className="bg-slate-800/50 border-slate-700">
                                    <CardHeader>
                                        <CardTitle className="text-white flex items-center gap-2">
                                            <Sparkles className="h-5 w-5 text-yellow-400" />
                                            Smart Suggestions
                                        </CardTitle>
                                        <p className="text-sm text-slate-400">Items below PAR level needing replenishment</p>
                                    </CardHeader>
                                    <CardContent>
                                        {recommendations.length > 0 ? (
                                            <div className="space-y-3">
                                                {recommendations.map((rec) => (
                                                    <div key={rec.ingredient_id} className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-800">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <p className="text-white font-medium">{rec.name}</p>
                                                                <Badge variant="outline" className="text-red-400 border-red-500/30 text-[10px]">
                                                                    Deficit: {rec.deficit}
                                                                </Badge>
                                                            </div>
                                                            <p className="text-xs text-slate-500 mt-1">
                                                                Stock: {rec.current_stock} / PAR: {rec.par_level} {rec.unit}
                                                            </p>
                                                        </div>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/20"
                                                            onClick={() => addToDraft(rec)}
                                                        >
                                                            <PlusCircle className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center py-8">
                                                <Check className="h-12 w-12 text-green-500 mx-auto mb-2 opacity-50" />
                                                <p className="text-slate-400">All stock levels healthy!</p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                                <Card className="bg-slate-800/50 border-slate-700">
                                    <CardHeader>
                                        <CardTitle className="text-white flex items-center gap-2">
                                            <List className="h-5 w-5 text-slate-400" />
                                            Add Manually
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-end gap-3">
                                            <div className="flex-1">
                                                <label className="text-xs text-slate-400 mb-1 block">Item Name</label>
                                                <Input
                                                    value={newItem.itemName}
                                                    onChange={(e) => setNewItem({ ...newItem, itemName: e.target.value })}
                                                    className="bg-slate-900 border-slate-600 text-white"
                                                    placeholder="Product name"
                                                />
                                            </div>
                                            <div className="w-24">
                                                <label className="text-xs text-slate-400 mb-1 block">Qty</label>
                                                <Input
                                                    type="number"
                                                    value={newItem.requestedQty || ""}
                                                    onChange={(e) => setNewItem({ ...newItem, requestedQty: parseFloat(e.target.value) || 0 })}
                                                    className="bg-slate-900 border-slate-600 text-white"
                                                />
                                            </div>
                                            <div className="w-24">
                                                <label className="text-xs text-slate-400 mb-1 block">Unit</label>
                                                <Input
                                                    value={newItem.unit}
                                                    onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                                                    className="bg-slate-900 border-slate-600 text-white"
                                                />
                                            </div>
                                            <Button onClick={addManualItem} className="bg-slate-700 hover:bg-slate-600">
                                                Add
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Right: Draft List */}
                            <div className="space-y-6">
                                <Card className="bg-emerald-900/10 border-emerald-600/30 border h-full">
                                    <CardHeader>
                                        <CardTitle className="text-emerald-400 flex items-center gap-2">
                                            <ShoppingCart className="h-5 w-5" />
                                            Purchase Request
                                        </CardTitle>
                                        <p className="text-sm text-slate-400">{draftItems.length} items to request</p>
                                    </CardHeader>
                                    <CardContent>
                                        {draftItems.length > 0 ? (
                                            <>
                                                <div className="space-y-3 mb-6">
                                                    {draftItems.map((item, idx) => (
                                                        <div key={idx} className="flex items-center justify-between p-2 rounded bg-slate-950/30 border border-emerald-500/10">
                                                            <div>
                                                                <p className="text-white text-sm font-medium">{item.itemName}</p>
                                                                <div className="flex items-center gap-1 text-xs text-slate-400">
                                                                    <span>{item.requestedQty} {item.unit}</span>
                                                                    {item.isRecommendation && (
                                                                        <Sparkles className="h-3 w-3 text-yellow-400" />
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
                                                                onClick={() => removeFromDraft(idx)}
                                                            >
                                                                <Trash className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>

                                                <div className="space-y-3 border-t border-slate-800 pt-4">
                                                    <div>
                                                        <label className="text-xs text-slate-400 mb-1 block">Requested By *</label>
                                                        <Input
                                                            value={requesterName}
                                                            onChange={(e) => setRequesterName(e.target.value)}
                                                            className="bg-slate-950 border-slate-700 text-white"
                                                            placeholder="Your Name"
                                                        />
                                                    </div>
                                                    <Button
                                                        className="w-full bg-emerald-600 hover:bg-emerald-700"
                                                        disabled={draftItems.length === 0 || !requesterName || createRequestMutation.isPending}
                                                        onClick={() => createRequestMutation.mutate()}
                                                    >
                                                        {createRequestMutation.isPending ? "Submitting..." : (
                                                            <>
                                                                <Check className="h-4 w-4 mr-2" />
                                                                Submit Request
                                                            </>
                                                        )}
                                                    </Button>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="text-center py-10 text-slate-500 text-sm">
                                                Add items from suggestions or manually
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
