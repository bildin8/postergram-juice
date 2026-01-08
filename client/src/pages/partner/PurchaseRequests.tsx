import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
    ShoppingCart,
    Plus,
    ArrowLeft,
    Search,
    Filter,
    Clock,
    CheckCircle,
    XCircle,
    MoreHorizontal
} from "lucide-react";
import { format } from "date-fns";

interface PRItem {
    id?: string;
    item_name: string; // Changed from itemName to match DB/Extension
    requested_qty: number;
    unit: string;
    estimated_cost: number;
    notes?: string;
}

interface PurchaseRequest {
    id: string;
    status: string;
    requested_by: string;
    requested_at: string;
    approved_by?: string;
    approved_at?: string;
    items: PRItem[];
    total_estimated?: number;
    notes?: string;
}

export default function PurchaseRequests() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newItem, setNewItem] = useState<{ name: string; qty: string; unit: string; cost: string; notes: string }>({
        name: "", qty: "", unit: "units", cost: "", notes: ""
    });
    const [requestItems, setRequestItems] = useState<any[]>([]);
    const [requestNotes, setRequestNotes] = useState("");

    // Fetch History (All PRs)
    // We'll use the queue endpoint but we might need a general "all" endpoint. 
    // The store route only returns "to-buy" (approved).
    // The approvals route returns "pending".
    // We probably need a new endpoint to get ALL history or combine them.
    // For now, let's look at `server/partnerPortalRoutes`... it has approvals.
    // Let's rely on `GET /api/partner/approvals` for pending, and maybe we need a history endpoint.
    // I'll stick to a simple "Active" view for now using the Approvals list + Store Queue?
    // Actually, let's create a specific fetch for this page if possible? 
    // Or just fetch `approved` from store queue and `pending` from partner approvals.

    // Fetch Pending
    const { data: pending = [] } = useQuery<PurchaseRequest[]>({
        queryKey: ["/api/partner/approvals"],
        queryFn: async () => {
            const res = await fetch("/api/partner/approvals");
            if (!res.ok) return [];
            const data = await res.json();
            return data.filter((d: any) => d.type === 'purchase_request').map((d: any) => d.data);
        }
    });

    // Fetch Approved/Completed (Store Queue)
    const { data: approved = [] } = useQuery<PurchaseRequest[]>({
        queryKey: ["/api/store/queue/to-buy"],
        queryFn: async () => {
            const res = await fetch("/api/store/queue/to-buy");
            if (!res.ok) return [];
            return res.json();
        }
    });

    const createMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/store/purchase-requests", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    requestedBy: "Partner", // Auto-set or prompt?
                    items: requestItems.map(i => ({
                        itemName: i.name,
                        requestedQty: parseFloat(i.qty),
                        unit: i.unit,
                        estimatedCost: parseFloat(i.cost) || 0,
                        notes: i.notes
                    })),
                    notes: requestNotes,
                    priority: "normal"
                }),
            });
            if (!res.ok) throw new Error("Failed to create request");
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Request Created", description: "Purchase request submitted." });
            queryClient.invalidateQueries({ queryKey: ["/api/partner/approvals"] });
            setIsCreateOpen(false);
            setRequestItems([]);
            setRequestNotes("");
        }
    });

    const addItem = () => {
        if (!newItem.name || !newItem.qty) return;
        setRequestItems([...requestItems, { ...newItem }]);
        setNewItem({ name: "", qty: "", unit: "units", cost: "", notes: "" });
    };

    const approveMutation = useMutation({
        mutationFn: async (id: string) => {
            // Self-approve endpoint
            const res = await fetch(`/api/partner/approve/purchase_request/${id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    approvedBy: "Partner", // In real app, this comes from auth context
                    notes: "Auto-approved by Partner creation"
                }),
            });
            if (!res.ok) throw new Error("Failed to approve");
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Approved", description: "Request sent to Store for execution." });
            queryClient.invalidateQueries({ queryKey: ["/api/partner/approvals"] });
            queryClient.invalidateQueries({ queryKey: ["/api/store/queue/to-buy"] });
        }
    });

    return (
        <div className="min-h-screen bg-slate-950 p-6">
            <div className="max-w-6xl mx-auto">
                <div className="mb-8">
                    <Link href="/partner">
                        <Button variant="ghost" className="text-slate-400 hover:text-white mb-4 pl-0">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Dashboard
                        </Button>
                    </Link>
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-3xl font-bold text-white mb-2">Purchase Requests</h1>
                            <p className="text-slate-400">Initiate and manage supplier purchases</p>
                        </div>
                        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                            <DialogTrigger asChild>
                                <Button className="bg-emerald-600 hover:bg-emerald-700">
                                    <Plus className="h-4 w-4 mr-2" />
                                    New Request
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl">
                                <DialogHeader>
                                    <DialogTitle>Create Purchase Request</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    {/* Add Item Form */}
                                    <div className="p-4 bg-slate-800/50 rounded-lg space-y-3">
                                        <h3 className="text-sm font-medium text-slate-300">Add Item</h3>
                                        <div className="grid grid-cols-2 gap-3">
                                            <Input
                                                placeholder="Item Name"
                                                value={newItem.name}
                                                onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                                                className="bg-slate-900 border-slate-700"
                                            />
                                            <div className="flex gap-2">
                                                <Input
                                                    type="number"
                                                    placeholder="Qty"
                                                    value={newItem.qty}
                                                    onChange={e => setNewItem({ ...newItem, qty: e.target.value })}
                                                    className="bg-slate-900 border-slate-700"
                                                />
                                                <Select value={newItem.unit} onValueChange={v => setNewItem({ ...newItem, unit: v })}>
                                                    <SelectTrigger className="w-[100px] bg-slate-900 border-slate-700">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="units">units</SelectItem>
                                                        <SelectItem value="kg">kg</SelectItem>
                                                        <SelectItem value="L">L</SelectItem>
                                                        <SelectItem value="pack">pack</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <Input
                                                type="number"
                                                placeholder="Est. Cost (Optional)"
                                                value={newItem.cost}
                                                onChange={e => setNewItem({ ...newItem, cost: e.target.value })}
                                                className="bg-slate-900 border-slate-700"
                                            />
                                            <Input
                                                placeholder="Notes"
                                                value={newItem.notes}
                                                onChange={e => setNewItem({ ...newItem, notes: e.target.value })}
                                                className="bg-slate-900 border-slate-700"
                                            />
                                        </div>
                                        <Button
                                            onClick={addItem}
                                            disabled={!newItem.name || !newItem.qty}
                                            variant="secondary"
                                            className="w-full mt-2"
                                        >
                                            Add to List
                                        </Button>
                                    </div>

                                    {/* List */}
                                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                        {requestItems.map((item, idx) => (
                                            <div key={idx} className="flex justify-between items-center p-3 bg-slate-800 rounded text-sm">
                                                <span>{item.name} ({item.qty} {item.unit})</span>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setRequestItems(requestItems.filter((_, i) => i !== idx))}
                                                >
                                                    Remove
                                                </Button>
                                            </div>
                                        ))}
                                    </div>

                                    <Input
                                        placeholder="Overall Details / Notes"
                                        value={requestNotes}
                                        onChange={e => setRequestNotes(e.target.value)}
                                        className="bg-slate-800 border-slate-700"
                                    />

                                    <Button
                                        className="w-full bg-emerald-600 hover:bg-emerald-700"
                                        disabled={requestItems.length === 0 || createMutation.isPending}
                                        onClick={() => createMutation.mutate()}
                                    >
                                        {createMutation.isPending ? "Submitting..." : "Submit Request"}
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

                {/* Suggestions Panel */}
                <div className="mb-8 p-4 bg-slate-900 border border-slate-800 rounded-lg">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                            <ShoppingCart className="h-5 w-5 text-emerald-500" />
                            <h3 className="text-lg font-medium text-white">Assisted Ordering</h3>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="text-emerald-500 border-emerald-600/50 hover:bg-emerald-600/10"
                            onClick={async () => {
                                const res = await fetch("/api/op/reports/below-par");
                                if (res.ok) {
                                    const suggestions = await res.json();
                                    const items = suggestions.map((s: any) => ({
                                        name: s.name,
                                        qty: s.qty_to_order > 0 ? s.qty_to_order.toString() : "0",
                                        unit: s.unit || 'units',
                                        cost: "",
                                        notes: "Auto-suggested based on PAR"
                                    })).filter((i: any) => parseFloat(i.qty) > 0);

                                    if (items.length > 0) {
                                        setRequestItems(items);
                                        setIsCreateOpen(true);
                                        toast({ title: "Suggestions Loaded", description: `Added ${items.length} items to request.` });
                                    } else {
                                        toast({ title: "Stock Healthy", description: "No items below PAR level." });
                                    }
                                }
                            }}
                        >
                            Load Suggestions based on PAR
                        </Button>
                    </div>
                    <p className="text-sm text-slate-400">
                        Automatically populate a purchase request with items that are below their minimum stock level.
                    </p>
                </div>

                <div className="space-y-8">
                    {/* Pending Section */}
                    <section>
                        <h2 className="text-xl font-semibold text-slate-200 mb-4 flex items-center gap-2">
                            <Clock className="h-5 w-5 text-amber-500" />
                            Pending Approval
                        </h2>
                        {pending.length === 0 ? (
                            <p className="text-slate-500 italic">No pending requests</p>
                        ) : (
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {pending.map((pr) => (
                                    <Card key={pr.id} className="bg-slate-900 border-slate-800">
                                        <CardHeader className="pb-2">
                                            <div className="flex justify-between items-start">
                                                <CardTitle className="text-white text-base">
                                                    {pr.requested_by}
                                                </CardTitle>
                                                <Badge variant="outline" className="border-amber-500 text-amber-500">
                                                    Pending
                                                </Badge>
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                {format(new Date(pr.requested_at), "MMM d, HH:mm")}
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="mb-4 space-y-1">
                                                {pr.items?.slice(0, 3).map((item, i) => (
                                                    <div key={i} className="text-sm text-slate-300 flex justify-between">
                                                        <span>{item.item_name}</span>
                                                        <span className="text-slate-500">x{item.requested_qty}</span>
                                                    </div>
                                                ))}
                                                {(pr.items?.length || 0) > 3 && (
                                                    <div className="text-xs text-slate-500">+{(pr.items?.length || 0) - 3} more</div>
                                                )}
                                            </div>
                                            <Button
                                                variant="outline"
                                                className="w-full border-emerald-600/50 text-emerald-500 hover:bg-emerald-600/10"
                                                onClick={() => approveMutation.mutate(pr.id)}
                                                disabled={approveMutation.isPending}
                                            >
                                                Approve & Send to Store
                                            </Button>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Approved/In-Queue Section */}
                    <section>
                        <h2 className="text-xl font-semibold text-slate-200 mb-4 flex items-center gap-2">
                            <CheckCircle className="h-5 w-5 text-blue-500" />
                            Sent to Store (To Buy)
                        </h2>
                        {approved.length === 0 ? (
                            <p className="text-slate-500 italic">No approved requests in queue</p>
                        ) : (
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {approved.map((pr) => (
                                    <Card key={pr.id} className="bg-slate-900/50 border-slate-800 opacity-75 hover:opacity-100 transition-opacity">
                                        <CardHeader className="pb-2">
                                            <div className="flex justify-between items-start">
                                                <CardTitle className="text-slate-300 text-base">
                                                    {pr.requested_by}
                                                </CardTitle>
                                                <Badge variant="secondary" className="bg-blue-900/30 text-blue-400">
                                                    Approved
                                                </Badge>
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                {format(new Date(pr.requested_at), "MMM d, HH:mm")}
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-sm text-slate-400">
                                                {pr.items?.length || 0} items waiting for execution
                                            </div>
                                            <div className="mt-2 text-xs text-slate-500">
                                                Approved by {pr.approved_by}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
}
