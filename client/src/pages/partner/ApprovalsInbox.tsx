import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
    ArrowLeft,
    Check,
    X,
    ShoppingCart,
    Package,
    ChevronDown,
    ChevronUp
} from "lucide-react";
import { Link } from "wouter";

interface ApprovalItem {
    id: string;
    item_name: string;
    requested_qty: number;
    unit: string;
    estimated_cost?: number;
}

interface Approval {
    type: string;
    id: string;
    data: {
        id: string;
        requested_by: string;
        requested_at: string;
        notes?: string;
        items?: ApprovalItem[];
    };
    requestedBy: string;
    requestedAt: string;
    priority: string;
    itemCount: number;
}

export default function ApprovalsInbox() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState("");
    const [rejectingId, setRejectingId] = useState<string | null>(null);

    const { data: approvals, isLoading } = useQuery<Approval[]>({
        queryKey: ["/api/partner/approvals"],
        queryFn: async () => {
            const res = await fetch("/api/partner/approvals");
            return res.json();
        },
    });

    const approveMutation = useMutation({
        mutationFn: async ({ type, id }: { type: string; id: string }) => {
            const res = await fetch(`/api/partner/approve/${type}/${id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ approvedBy: "Partner" }),
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || "Failed to approve");
            }

            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Approved", description: "Request has been approved." });
            queryClient.invalidateQueries({ queryKey: ["/api/partner/approvals"] });
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });

    const rejectMutation = useMutation({
        mutationFn: async ({ type, id, reason }: { type: string; id: string; reason: string }) => {
            const res = await fetch(`/api/partner/reject/${type}/${id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rejectedBy: "Partner", reason }),
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || "Failed to reject");
            }

            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Rejected", description: "Request has been rejected." });
            queryClient.invalidateQueries({ queryKey: ["/api/partner/approvals"] });
            setRejectingId(null);
            setRejectReason("");
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });

    const handleReject = (type: string, id: string) => {
        if (!rejectReason.trim()) {
            toast({ title: "Error", description: "Please provide a rejection reason", variant: "destructive" });
            return;
        }
        rejectMutation.mutate({ type, id, reason: rejectReason });
    };

    const toggleExpand = (id: string) => {
        setExpandedId((prev) => (prev === id ? null : id));
    };

    const getTypeLabel = (type: string) => {
        return type === "purchase_request" ? "Purchase Request" : "Replenishment Request";
    };

    const getTypeIcon = (type: string) => {
        return type === "purchase_request" ? ShoppingCart : Package;
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case "urgent":
                return "bg-red-600";
            case "high":
                return "bg-orange-600";
            case "normal":
                return "bg-blue-600";
            default:
                return "bg-slate-600";
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-900 p-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <Link href="/partner">
                        <Button variant="ghost" className="text-slate-400 hover:text-white mb-4">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Partner
                        </Button>
                    </Link>
                    <h1 className="text-2xl font-bold text-white mb-2">Approvals Inbox</h1>
                    <p className="text-slate-400">
                        {approvals?.length || 0} requests pending your review
                    </p>
                </div>

                {/* Loading */}
                {isLoading && (
                    <div className="text-center py-12">
                        <p className="text-slate-400">Loading approvals...</p>
                    </div>
                )}

                {/* Empty State */}
                {!isLoading && (!approvals || approvals.length === 0) && (
                    <Card className="bg-slate-800/30 border-slate-700">
                        <CardContent className="py-12 text-center">
                            <Check className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
                            <h2 className="text-xl font-bold text-white mb-2">All Clear!</h2>
                            <p className="text-slate-400">No pending approvals at the moment.</p>
                        </CardContent>
                    </Card>
                )}

                {/* Approvals List */}
                <div className="space-y-4">
                    {approvals?.map((approval) => {
                        const Icon = getTypeIcon(approval.type);
                        const isExpanded = expandedId === approval.id;
                        const isRejecting = rejectingId === approval.id;

                        return (
                            <Card
                                key={approval.id}
                                className="bg-slate-800/50 border-slate-700 overflow-hidden"
                            >
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg ${approval.type === "purchase_request" ? "bg-blue-600" : "bg-purple-600"
                                                }`}>
                                                <Icon className="h-5 w-5 text-white" />
                                            </div>
                                            <div>
                                                <CardTitle className="text-white text-lg">
                                                    {getTypeLabel(approval.type)}
                                                </CardTitle>
                                                <p className="text-sm text-slate-400">
                                                    by {approval.requestedBy} • {new Date(approval.requestedAt).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge className={getPriorityColor(approval.priority)}>
                                                {approval.priority}
                                            </Badge>
                                            <Badge variant="outline" className="border-slate-600 text-slate-400">
                                                {approval.itemCount} items
                                            </Badge>
                                        </div>
                                    </div>
                                </CardHeader>

                                <CardContent className="pt-2">
                                    {/* Expand/Collapse */}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => toggleExpand(approval.id)}
                                        className="w-full text-slate-400 hover:text-white mb-3"
                                    >
                                        {isExpanded ? (
                                            <>
                                                <ChevronUp className="h-4 w-4 mr-2" />
                                                Hide Details
                                            </>
                                        ) : (
                                            <>
                                                <ChevronDown className="h-4 w-4 mr-2" />
                                                View Items
                                            </>
                                        )}
                                    </Button>

                                    {/* Items List */}
                                    {isExpanded && approval.data.items && (
                                        <div className="bg-slate-900/50 rounded-lg p-4 mb-4">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="text-slate-400 border-b border-slate-700">
                                                        <th className="text-left py-2">Item</th>
                                                        <th className="text-right py-2">Qty</th>
                                                        <th className="text-right py-2">Unit</th>
                                                        {approval.type === "purchase_request" && (
                                                            <th className="text-right py-2">Est. Cost</th>
                                                        )}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {approval.data.items.map((item, idx) => (
                                                        <tr key={idx} className="border-b border-slate-800">
                                                            <td className="text-white py-2">{item.item_name}</td>
                                                            <td className="text-white py-2 text-right">{item.requested_qty}</td>
                                                            <td className="text-slate-400 py-2 text-right">{item.unit}</td>
                                                            {approval.type === "purchase_request" && (
                                                                <td className="text-emerald-400 py-2 text-right">
                                                                    {item.estimated_cost ? `KES ${item.estimated_cost.toLocaleString()}` : "-"}
                                                                </td>
                                                            )}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    {/* Reject Reason Input */}
                                    {isRejecting && (
                                        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-4">
                                            <p className="text-sm text-red-300 mb-2">Rejection Reason:</p>
                                            <Input
                                                value={rejectReason}
                                                onChange={(e) => setRejectReason(e.target.value)}
                                                placeholder="Enter reason for rejection"
                                                className="bg-slate-900 border-slate-600 text-white mb-3"
                                            />
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    onClick={() => handleReject(approval.type, approval.id)}
                                                    disabled={rejectMutation.isPending}
                                                >
                                                    Confirm Reject
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => {
                                                        setRejectingId(null);
                                                        setRejectReason("");
                                                    }}
                                                >
                                                    Cancel
                                                </Button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Action Buttons */}
                                    {!isRejecting && (
                                        <div className="flex gap-3">
                                            <Button
                                                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                                                onClick={() => approveMutation.mutate({ type: approval.type, id: approval.id })}
                                                disabled={approveMutation.isPending}
                                            >
                                                <Check className="h-4 w-4 mr-2" />
                                                Approve
                                            </Button>
                                            <Button
                                                variant="outline"
                                                className="flex-1 border-red-600 text-red-400 hover:bg-red-900/20"
                                                onClick={() => setRejectingId(approval.id)}
                                            >
                                                <X className="h-4 w-4 mr-2" />
                                                Reject
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
