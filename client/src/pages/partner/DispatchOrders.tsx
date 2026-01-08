import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
    Truck,
    Plus,
    ArrowLeft,
    Clock,
    CheckCircle,
} from "lucide-react";
import { format } from "date-fns";

interface SRRItem {
    id?: string;
    item_name: string;
    requested_qty: number;
    unit: string;
    notes?: string;
}

interface SRR {
    id: string;
    status: string;
    requested_by: string;
    requested_at: string;
    approved_by?: string;
    approved_at?: string;
    items: SRRItem[];
    notes?: string;
}

export default function DispatchOrders() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newItem, setNewItem] = useState<{ name: string; qty: string; unit: string; notes: string }>({
        name: "", qty: "", unit: "units", notes: ""
    });
    const [requestItems, setRequestItems] = useState<any[]>([]);
    const [requestNotes, setRequestNotes] = useState("");
    const [autoApprove, setAutoApprove] = useState(true);

    // Fetch Pending (Partner Approvals endpoint)
    const { data: pending = [] } = useQuery<SRR[]>({
        queryKey: ["/api/partner/approvals"],
        queryFn: async () => {
            const res = await fetch("/api/partner/approvals");
            if (!res.ok) return [];
            const data = await res.json();
            return data.filter((d: any) => d.type === 'replenishment_request').map((d: any) => d.data);
        }
    });

    // Fetch Approved (Store Dispatch Queue)
    const { data: approved = [] } = useQuery<SRR[]>({
        queryKey: ["/api/store/queue/to-dispatch"],
        queryFn: async () => {
            const res = await fetch("/api/store/queue/to-dispatch");
            if (!res.ok) return [];
            return res.json();
        }
    });

    const createMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/shop/replenishment-requests", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    requestedBy: "Partner", // In real app, from auth
                    items: requestItems.map(i => ({
                        itemName: i.name,
                        requestedQty: parseFloat(i.qty),
                        unit: i.unit,
                        notes: i.notes
                    })),
                    notes: requestNotes,
                    priority: "normal",
                    status: autoApprove ? "approved" : "pending"
                }),
            });
            if (!res.ok) throw new Error("Failed to create dispatch order");
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Order Created", description: autoApprove ? "Sent to Store for dispatch." : "Pending approval." });
            queryClient.invalidateQueries({ queryKey: ["/api/partner/approvals"] });
            queryClient.invalidateQueries({ queryKey: ["/api/store/queue/to-dispatch"] });
            setIsCreateOpen(false);
            setRequestItems([]);
            setRequestNotes("");
        }
    });

    const approveMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/partner/approve/replenishment_request/${id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    approvedBy: "Partner",
                    notes: "Manually approved from list"
                }),
            });
            if (!res.ok) throw new Error("Failed to approve");
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Approved", description: "Sent to Store for dispatch." });
            queryClient.invalidateQueries({ queryKey: ["/api/partner/approvals"] });
            queryClient.invalidateQueries({ queryKey: ["/api/store/queue/to-dispatch"] });
        }
    });

    const addItem = () => {
        if (!newItem.name || !newItem.qty) return;
        setRequestItems([...requestItems, { ...newItem }]);
        setNewItem({ name: "", qty: "", unit: "units", notes: "" });
    };

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
                            <h1 className="text-3xl font-bold text-white mb-2">Dispatch Orders</h1>
                            <p className="text-slate-400">Instruct Store to send stock to Shop</p>
                        </div>
                        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                            <DialogTrigger asChild>
                                <Button className="bg-blue-600 hover:bg-blue-700">
                                    <Plus className="h-4 w-4 mr-2" />
                                    New Order
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl">
                                <DialogHeader>
                                    <DialogTitle>Create Dispatch Order</DialogTitle>
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
                                                <Input
                                                    placeholder="Unit"
                                                    value={newItem.unit}
                                                    onChange={e => setNewItem({ ...newItem, unit: e.target.value })}
                                                    className="bg-slate-900 border-slate-700 w-[100px]"
                                                />
                                            </div>
                                            <Input
                                                placeholder="Notes (Optional)"
                                                value={newItem.notes}
                                                onChange={e => setNewItem({ ...newItem, notes: e.target.value })}
                                                className="bg-slate-900 border-slate-700 col-span-2"
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
                                        placeholder="Order Notes"
                                        value={requestNotes}
                                        onChange={e => setRequestNotes(e.target.value)}
                                        className="bg-slate-800 border-slate-700"
                                    />

                                    <div className="flex items-center space-x-2 py-2">
                                        <Checkbox
                                            id="auto-approve"
                                            checked={autoApprove}
                                            onCheckedChange={(c) => setAutoApprove(!!c)}
                                            className="border-slate-500 data-[state=checked]:bg-blue-600"
                                        />
                                        <Label htmlFor="auto-approve" className="text-slate-300 text-sm">
                                            Immediately Approve & Send to Store
                                        </Label>
                                    </div>

                                    <Button
                                        className="w-full bg-blue-600 hover:bg-blue-700"
                                        disabled={requestItems.length === 0 || createMutation.isPending}
                                        onClick={() => createMutation.mutate()}
                                    >
                                        {createMutation.isPending ? "Submitting..." : "Submit Order"}
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

                <div className="space-y-8">
                    {/* Pending Section */}
                    {pending.length > 0 && (
                        <section>
                            <h2 className="text-xl font-semibold text-slate-200 mb-4 flex items-center gap-2">
                                <Clock className="h-5 w-5 text-amber-500" />
                                Pending Approval
                            </h2>
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {pending.map((srr) => (
                                    <Card key={srr.id} className="bg-slate-900 border-slate-800">
                                        <CardHeader className="pb-2">
                                            <div className="flex justify-between items-start">
                                                <CardTitle className="text-white text-base">
                                                    {srr.requested_by}
                                                </CardTitle>
                                                <Badge variant="outline" className="border-amber-500 text-amber-500">
                                                    Pending
                                                </Badge>
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                {format(new Date(srr.requested_at), "MMM d, HH:mm")}
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="mb-4 space-y-1">
                                                {srr.items?.slice(0, 3).map((item, i) => (
                                                    <div key={i} className="text-sm text-slate-300 flex justify-between">
                                                        <span>{item.item_name}</span>
                                                        <span className="text-slate-500">x{item.requested_qty}</span>
                                                    </div>
                                                ))}
                                                {(srr.items?.length || 0) > 3 && (
                                                    <div className="text-xs text-slate-500">+{(srr.items?.length || 0) - 3} more</div>
                                                )}
                                            </div>
                                            <Button
                                                variant="outline"
                                                className="w-full border-blue-600/50 text-blue-500 hover:bg-blue-600/10"
                                                onClick={() => approveMutation.mutate(srr.id)}
                                                disabled={approveMutation.isPending}
                                            >
                                                Approve Dispatch
                                            </Button>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Approved/In-Queue Section */}
                    <section>
                        <h2 className="text-xl font-semibold text-slate-200 mb-4 flex items-center gap-2">
                            <Truck className="h-5 w-5 text-blue-500" />
                            Queued for Dispatch (At Store)
                        </h2>
                        {approved.length === 0 ? (
                            <p className="text-slate-500 italic">No orders queued for dispatch.</p>
                        ) : (
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {approved.map((srr) => (
                                    <Card key={srr.id} className="bg-slate-900/50 border-slate-800 opacity-75 hover:opacity-100 transition-opacity">
                                        <CardHeader className="pb-2">
                                            <div className="flex justify-between items-start">
                                                <CardTitle className="text-slate-300 text-base">
                                                    {srr.requested_by}
                                                </CardTitle>
                                                <Badge variant="secondary" className="bg-blue-900/30 text-blue-400">
                                                    Approved
                                                </Badge>
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                {format(new Date(srr.requested_at), "MMM d, HH:mm")}
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-sm text-slate-400">
                                                {srr.items?.length || 0} items waiting for store to pick
                                            </div>
                                            <div className="mt-2 text-xs text-slate-500">
                                                Approved by {srr.approved_by}
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
