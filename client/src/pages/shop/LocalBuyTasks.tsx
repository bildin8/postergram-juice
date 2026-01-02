import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
    ArrowLeft,
    ShoppingBag,
    Check,
    Camera
} from "lucide-react";
import { Link } from "wouter";

interface LocalBuyTask {
    id: string;
    item_name: string;
    quantity: number;
    unit: string;
    max_budget: number;
    status: string;
    assigned_to?: string;
    notes?: string;
    created_at: string;
}

export default function LocalBuyTasks() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [selectedTask, setSelectedTask] = useState<LocalBuyTask | null>(null);
    const [actualQty, setActualQty] = useState(0);
    const [actualCost, setActualCost] = useState(0);
    const [executedBy, setExecutedBy] = useState("");

    // Fetch assigned tasks
    const { data: tasks, isLoading } = useQuery<LocalBuyTask[]>({
        queryKey: ["/api/shop/local-buy-tasks"],
        queryFn: async () => {
            const res = await fetch("/api/shop/local-buy-tasks");
            return res.json();
        },
    });

    // Complete task
    const completeMutation = useMutation({
        mutationFn: async () => {
            if (!selectedTask) throw new Error("No task selected");

            const res = await fetch(`/api/shop/local-buy-tasks/${selectedTask.id}/execute`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    actualQty,
                    actualAmount: actualCost,
                    executedBy,
                }),
            });

            if (!res.ok) {
                throw new Error("Failed to complete task");
            }

            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Task Completed", description: "Local buy has been recorded." });
            queryClient.invalidateQueries({ queryKey: ["/api/shop/local-buy-tasks"] });
            setSelectedTask(null);
            setActualQty(0);
            setActualCost(0);
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });

    const startTask = (task: LocalBuyTask) => {
        setSelectedTask(task);
        setActualQty(task.quantity);
        setActualCost(task.max_budget);
    };

    // Execution form
    if (selectedTask) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-slate-900 to-slate-900 p-6">
                <div className="max-w-2xl mx-auto">
                    <Button
                        variant="ghost"
                        className="text-slate-400 hover:text-white mb-4"
                        onClick={() => setSelectedTask(null)}
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Tasks
                    </Button>

                    <Card className="bg-slate-800/50 border-slate-700">
                        <CardHeader>
                            <CardTitle className="text-white flex items-center gap-2">
                                <ShoppingBag className="h-5 w-5 text-blue-500" />
                                Complete Local Buy
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {/* Task Info */}
                            <div className="p-4 rounded-lg bg-slate-900/50 mb-6">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-white font-medium text-lg">{selectedTask.item_name}</p>
                                    <Badge className="bg-blue-600">
                                        Target: {selectedTask.quantity} {selectedTask.unit}
                                    </Badge>
                                </div>
                                <p className="text-slate-400">
                                    Max budget: KES {selectedTask.max_budget.toLocaleString()}
                                </p>
                                {selectedTask.notes && (
                                    <p className="text-sm text-slate-500 mt-2">
                                        Notes: {selectedTask.notes}
                                    </p>
                                )}
                            </div>

                            {/* Execution Form */}
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label className="text-slate-300">Qty Purchased</Label>
                                        <Input
                                            type="number"
                                            value={actualQty}
                                            onChange={(e) => setActualQty(parseFloat(e.target.value) || 0)}
                                            className="bg-slate-900 border-slate-600 text-white"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-slate-300">Actual Cost (KES)</Label>
                                        <Input
                                            type="number"
                                            value={actualCost}
                                            onChange={(e) => setActualCost(parseFloat(e.target.value) || 0)}
                                            className="bg-slate-900 border-slate-600 text-white"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <Label className="text-slate-300">Executed By</Label>
                                    <Input
                                        value={executedBy}
                                        onChange={(e) => setExecutedBy(e.target.value)}
                                        placeholder="Your name"
                                        className="bg-slate-900 border-slate-600 text-white"
                                    />
                                </div>

                                <Button variant="outline" className="w-full border-slate-600 text-slate-400">
                                    <Camera className="h-4 w-4 mr-2" />
                                    Attach Receipt (Optional)
                                </Button>

                                {/* Budget Warning */}
                                {actualCost > selectedTask.max_budget && (
                                    <div className="p-3 rounded-lg bg-amber-900/30 border border-amber-600">
                                        <p className="text-amber-300 text-sm">
                                            ⚠️ Cost exceeds budget by KES {(actualCost - selectedTask.max_budget).toLocaleString()}
                                        </p>
                                    </div>
                                )}

                                <Button
                                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                                    disabled={!executedBy || completeMutation.isPending}
                                    onClick={() => completeMutation.mutate()}
                                >
                                    {completeMutation.isPending ? "Completing..." : (
                                        <>
                                            <Check className="h-4 w-4 mr-2" />
                                            Complete Task
                                        </>
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

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
                    <h1 className="text-2xl font-bold text-white mb-2">Local Buy Tasks</h1>
                    <p className="text-slate-400">
                        {tasks?.filter(t => t.status === 'assigned').length || 0} pending tasks
                    </p>
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
                            <h2 className="text-xl font-bold text-white mb-2">No Tasks Assigned</h2>
                            <p className="text-slate-400">No local buy tasks at the moment.</p>
                        </CardContent>
                    </Card>
                )}

                {/* Tasks List */}
                <div className="space-y-4">
                    {tasks?.filter(t => t.status === 'assigned').map((task) => (
                        <Card key={task.id} className="bg-slate-800/50 border-slate-700">
                            <CardContent className="py-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 rounded-lg bg-blue-600">
                                            <ShoppingBag className="h-5 w-5 text-white" />
                                        </div>
                                        <div>
                                            <p className="text-white font-medium">{task.item_name}</p>
                                            <p className="text-sm text-slate-400">
                                                {task.quantity} {task.unit} • Max: KES {task.max_budget.toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                    <Button
                                        className="bg-blue-600 hover:bg-blue-700"
                                        onClick={() => startTask(task)}
                                    >
                                        Start Task
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    );
}
