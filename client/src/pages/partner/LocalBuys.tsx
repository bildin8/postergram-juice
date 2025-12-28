import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
    ArrowLeft,
    ShoppingBag,
    Plus,
    Clock,
    CheckCircle,
    XCircle,
    AlertTriangle
} from "lucide-react";
import { Link } from "wouter";

interface LocalBuyTask {
    id: string;
    item_name: string;
    max_qty?: number;
    spend_cap?: number;
    expires_at?: string;
    status: string;
    executed_at?: string;
    executed_by?: string;
    actual_qty?: number;
    actual_amount?: number;
    created_at: string;
    created_by?: string;
}

export default function LocalBuys() {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [newTask, setNewTask] = useState({
        itemName: "",
        maxQty: 0,
        spendCap: 0,
        expiresInHours: 24,
        notes: "",
    });

    // Fetch all local buy tasks
    const { data: tasks, isLoading } = useQuery<LocalBuyTask[]>({
        queryKey: ["/api/partner/local-buy-tasks"],
        queryFn: async () => {
            const res = await fetch("/api/partner/local-buy-tasks");
            if (!res.ok) return [];
            return res.json();
        },
    });

    // Create task mutation
    const createMutation = useMutation({
        mutationFn: async (task: typeof newTask) => {
            const res = await fetch("/api/partner/local-buy-tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(task),
            });
            if (!res.ok) throw new Error("Failed to create task");
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Task Created", description: "Shop staff can now execute this purchase" });
            queryClient.invalidateQueries({ queryKey: ["/api/partner/local-buy-tasks"] });
            setShowCreateDialog(false);
            setNewTask({ itemName: "", maxQty: 0, spendCap: 0, expiresInHours: 24, notes: "" });
        },
        onError: () => {
            toast({ title: "Error", description: "Failed to create task", variant: "destructive" });
        },
    });

    // Cancel task mutation
    const cancelMutation = useMutation({
        mutationFn: async (taskId: string) => {
            const res = await fetch(`/api/partner/local-buy-tasks/${taskId}/cancel`, {
                method: "POST",
            });
            if (!res.ok) throw new Error("Failed to cancel task");
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Task Cancelled", description: "The task has been cancelled" });
            queryClient.invalidateQueries({ queryKey: ["/api/partner/local-buy-tasks"] });
        },
        onError: () => {
            toast({ title: "Error", description: "Failed to cancel task", variant: "destructive" });
        },
    });

    const pendingTasks = (tasks || []).filter(t => t.status === "pending");
    const executedTasks = (tasks || []).filter(t => t.status === "executed");
    const cancelledTasks = (tasks || []).filter(t => t.status === "cancelled" || t.status === "expired");

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "pending":
                return <Badge className="bg-amber-600"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
            case "executed":
                return <Badge className="bg-emerald-600"><CheckCircle className="h-3 w-3 mr-1" />Executed</Badge>;
            case "cancelled":
                return <Badge className="bg-red-600"><XCircle className="h-3 w-3 mr-1" />Cancelled</Badge>;
            case "expired":
                return <Badge className="bg-slate-600"><AlertTriangle className="h-3 w-3 mr-1" />Expired</Badge>;
            default:
                return <Badge>{status}</Badge>;
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
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-white mb-2">Local Buy Tasks</h1>
                            <p className="text-slate-400">Authorize Shop staff to make supermarket purchases</p>
                        </div>
                        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                            <DialogTrigger asChild>
                                <Button className="bg-blue-600 hover:bg-blue-700">
                                    <Plus className="h-4 w-4 mr-2" />
                                    Create Task
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-slate-800 border-slate-700">
                                <DialogHeader>
                                    <DialogTitle className="text-white">Create Local Buy Task</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                    <div>
                                        <Label className="text-slate-300">Item to Purchase</Label>
                                        <Input
                                            value={newTask.itemName}
                                            onChange={(e) => setNewTask({ ...newTask, itemName: e.target.value })}
                                            placeholder="e.g. Milk, Sugar, Eggs"
                                            className="bg-slate-900 border-slate-600 text-white"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label className="text-slate-300">Max Quantity (optional)</Label>
                                            <Input
                                                type="number"
                                                value={newTask.maxQty || ""}
                                                onChange={(e) => setNewTask({ ...newTask, maxQty: parseFloat(e.target.value) || 0 })}
                                                placeholder="0 = no limit"
                                                className="bg-slate-900 border-slate-600 text-white"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-slate-300">Spend Cap (KES)</Label>
                                            <Input
                                                type="number"
                                                value={newTask.spendCap || ""}
                                                onChange={(e) => setNewTask({ ...newTask, spendCap: parseFloat(e.target.value) || 0 })}
                                                placeholder="Max amount"
                                                className="bg-slate-900 border-slate-600 text-white"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <Label className="text-slate-300">Expires In (hours)</Label>
                                        <Input
                                            type="number"
                                            value={newTask.expiresInHours}
                                            onChange={(e) => setNewTask({ ...newTask, expiresInHours: parseInt(e.target.value) || 24 })}
                                            className="bg-slate-900 border-slate-600 text-white"
                                        />
                                        <p className="text-xs text-slate-500 mt-1">
                                            Task will expire if not completed within this time
                                        </p>
                                    </div>
                                    <div>
                                        <Label className="text-slate-300">Notes (optional)</Label>
                                        <Input
                                            value={newTask.notes}
                                            onChange={(e) => setNewTask({ ...newTask, notes: e.target.value })}
                                            placeholder="Any special instructions"
                                            className="bg-slate-900 border-slate-600 text-white"
                                        />
                                    </div>
                                    <Button
                                        className="w-full bg-blue-600 hover:bg-blue-700"
                                        disabled={!newTask.itemName || !newTask.spendCap || createMutation.isPending}
                                        onClick={() => createMutation.mutate(newTask)}
                                    >
                                        {createMutation.isPending ? "Creating..." : "Create Task"}
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <Card className="bg-amber-900/30 border-amber-600">
                        <CardContent className="pt-6 text-center">
                            <p className="text-2xl font-bold text-amber-400">{pendingTasks.length}</p>
                            <p className="text-sm text-amber-300">Pending</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-emerald-900/30 border-emerald-600">
                        <CardContent className="pt-6 text-center">
                            <p className="text-2xl font-bold text-emerald-400">{executedTasks.length}</p>
                            <p className="text-sm text-emerald-300">Executed</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-slate-800/50 border-slate-600">
                        <CardContent className="pt-6 text-center">
                            <p className="text-2xl font-bold text-slate-400">{cancelledTasks.length}</p>
                            <p className="text-sm text-slate-400">Cancelled/Expired</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Loading */}
                {isLoading && (
                    <div className="text-center py-12">
                        <p className="text-slate-400">Loading tasks...</p>
                    </div>
                )}

                {/* Empty State */}
                {!isLoading && (!tasks || tasks.length === 0) && (
                    <Card className="bg-slate-800/30 border-slate-700">
                        <CardContent className="py-12 text-center">
                            <ShoppingBag className="h-16 w-16 text-slate-600 mx-auto mb-4" />
                            <h2 className="text-xl font-bold text-white mb-2">No Local Buy Tasks</h2>
                            <p className="text-slate-400 mb-4">
                                Create a task to authorize Shop staff to make purchases at nearby stores
                            </p>
                            <Button className="bg-blue-600" onClick={() => setShowCreateDialog(true)}>
                                <Plus className="h-4 w-4 mr-2" />
                                Create First Task
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {/* Pending Tasks */}
                {pendingTasks.length > 0 && (
                    <Card className="bg-slate-800/50 border-slate-700 mb-6">
                        <CardHeader>
                            <CardTitle className="text-white flex items-center gap-2">
                                <Clock className="h-5 w-5 text-amber-500" />
                                Pending Tasks
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {pendingTasks.map((task) => (
                                    <div
                                        key={task.id}
                                        className="flex items-center justify-between p-4 rounded-lg bg-slate-900/50"
                                    >
                                        <div>
                                            <p className="text-white font-medium">{task.item_name}</p>
                                            <div className="flex gap-4 text-sm text-slate-400 mt-1">
                                                {task.max_qty && <span>Max: {task.max_qty}</span>}
                                                {task.spend_cap && <span>Cap: KES {task.spend_cap.toLocaleString()}</span>}
                                                {task.expires_at && (
                                                    <span>Expires: {new Date(task.expires_at).toLocaleString()}</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {getStatusBadge(task.status)}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-red-400"
                                                onClick={() => cancelMutation.mutate(task.id)}
                                            >
                                                <XCircle className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Executed Tasks */}
                {executedTasks.length > 0 && (
                    <Card className="bg-slate-800/30 border-slate-700">
                        <CardHeader>
                            <CardTitle className="text-white flex items-center gap-2">
                                <CheckCircle className="h-5 w-5 text-emerald-500" />
                                Completed
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {executedTasks.slice(0, 10).map((task) => (
                                    <div
                                        key={task.id}
                                        className="flex items-center justify-between p-4 rounded-lg bg-slate-900/30"
                                    >
                                        <div>
                                            <p className="text-white font-medium">{task.item_name}</p>
                                            <div className="flex gap-4 text-sm text-slate-400 mt-1">
                                                <span>Qty: {task.actual_qty}</span>
                                                <span>Spent: KES {task.actual_amount?.toLocaleString()}</span>
                                                <span>By: {task.executed_by}</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            {getStatusBadge(task.status)}
                                            <p className="text-xs text-slate-500 mt-1">
                                                {task.executed_at && new Date(task.executed_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
