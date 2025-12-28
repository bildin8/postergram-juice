import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
    ArrowLeft,
    Package,
    Check,
    Truck,
    ClipboardCheck
} from "lucide-react";
import { Link } from "wouter";

interface Dispatch {
    id: string;
    sent_by: string;
    sent_at: string;
    total_items: number;
    status: string;
    notes?: string;
    items: Array<{
        id: string;
        item_name: string;
        picked_qty: number;
        unit: string;
    }>;
}

export default function ReceiveDispatch() {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Fetch pending dispatches
    const { data: pending, isLoading } = useQuery<Dispatch[]>({
        queryKey: ["/api/shop-portal/pending-dispatches"],
        queryFn: async () => {
            const res = await fetch("/api/shop-portal/pending-dispatches");
            return res.json();
        },
    });

    // Confirm receipt
    const confirmMutation = useMutation({
        mutationFn: async (dispatchId: string) => {
            const res = await fetch(`/api/shop-portal/dispatches/${dispatchId}/confirm`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ confirmedBy: "Shop Staff" }),
            });

            if (!res.ok) {
                throw new Error("Failed to confirm dispatch");
            }

            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Dispatch Confirmed", description: "Items added to shop stock." });
            queryClient.invalidateQueries({ queryKey: ["/api/shop-portal/pending-dispatches"] });
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });

    return (
        <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-slate-900 to-slate-900 p-6">
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <Link href="/shop">
                        <Button variant="ghost" className="text-slate-400 hover:text-white mb-4">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Shop
                        </Button>
                    </Link>
                    <h1 className="text-2xl font-bold text-white mb-2">Receive Dispatches</h1>
                    <p className="text-slate-400">
                        {pending?.length || 0} pending deliveries from store
                    </p>
                </div>

                {/* Loading */}
                {isLoading && (
                    <div className="text-center py-12">
                        <p className="text-slate-400">Loading dispatches...</p>
                    </div>
                )}

                {/* Empty State */}
                {!isLoading && (!pending || pending.length === 0) && (
                    <Card className="bg-slate-800/30 border-slate-700">
                        <CardContent className="py-12 text-center">
                            <Truck className="h-16 w-16 text-slate-600 mx-auto mb-4" />
                            <h2 className="text-xl font-bold text-white mb-2">No Pending Dispatches</h2>
                            <p className="text-slate-400">All deliveries have been received.</p>
                        </CardContent>
                    </Card>
                )}

                {/* Dispatches List */}
                <div className="space-y-4">
                    {pending?.map((dispatch) => (
                        <Card key={dispatch.id} className="bg-slate-800/50 border-slate-700">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-teal-600">
                                            <Package className="h-5 w-5 text-white" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-white text-lg">
                                                Dispatch from Store
                                            </CardTitle>
                                            <p className="text-sm text-slate-400">
                                                Sent by {dispatch.sent_by} • {new Date(dispatch.sent_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <Badge className="bg-blue-600">
                                        {dispatch.total_items} items
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {/* Items Preview */}
                                <div className="mb-4 p-3 rounded-lg bg-slate-900/50">
                                    <div className="space-y-2">
                                        {dispatch.items?.slice(0, 5).map((item, idx) => (
                                            <div key={idx} className="flex items-center justify-between">
                                                <span className="text-slate-300">{item.item_name}</span>
                                                <Badge variant="outline" className="border-slate-600 text-slate-300">
                                                    {item.picked_qty} {item.unit}
                                                </Badge>
                                            </div>
                                        ))}
                                        {(dispatch.items?.length || 0) > 5 && (
                                            <p className="text-sm text-slate-500">
                                                +{(dispatch.items?.length || 0) - 5} more items
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {dispatch.notes && (
                                    <p className="text-sm text-slate-400 mb-4">
                                        Notes: {dispatch.notes}
                                    </p>
                                )}

                                <Button
                                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                                    disabled={confirmMutation.isPending}
                                    onClick={() => confirmMutation.mutate(dispatch.id)}
                                >
                                    {confirmMutation.isPending ? "Confirming..." : (
                                        <>
                                            <ClipboardCheck className="h-4 w-4 mr-2" />
                                            Confirm Receipt
                                        </>
                                    )}
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    );
}
