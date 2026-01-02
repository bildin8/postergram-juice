import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Square, Clock, Wallet, Users } from "lucide-react";
import { Link } from "wouter";

interface Shift {
    id: string;
    status: string;
    opened_at: string;
    opened_by: string;
    opening_float: number;
    staff_on_duty: string[];
}

export default function ShiftClose() {
    const [, setLocation] = useLocation();
    const { toast } = useToast();

    const [closedBy, setClosedBy] = useState("");
    const [closingCash, setClosingCash] = useState("");

    // Get current shift
    const { data: currentShift, isLoading } = useQuery<Shift | null>({
        queryKey: ["/api/shop/shifts/current"],
        queryFn: async () => {
            const res = await fetch("/api/shop/shifts/current");
            if (!res.ok) return null;
            return res.json();
        },
    });

    const closeShiftMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/shop/shifts/close", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    closedBy,
                    closingCash: parseFloat(closingCash),
                }),
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || "Failed to close shift");
            }

            return res.json();
        },
        onSuccess: () => {
            toast({
                title: "Shift Closed",
                description: "Your shift has been closed successfully.",
            });
            setLocation("/shop");
        },
        onError: (error: Error) => {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!closedBy.trim()) {
            toast({ title: "Error", description: "Please enter your name", variant: "destructive" });
            return;
        }

        if (!closingCash || parseFloat(closingCash) < 0) {
            toast({ title: "Error", description: "Please enter the closing cash amount", variant: "destructive" });
            return;
        }

        closeShiftMutation.mutate();
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-slate-900 to-slate-900 p-6 flex items-center justify-center">
                <p className="text-white">Loading...</p>
            </div>
        );
    }

    if (!currentShift) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-slate-900 to-slate-900 p-6">
                <div className="max-w-lg mx-auto text-center py-12">
                    <Clock className="h-16 w-16 text-slate-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-white mb-2">No Open Shift</h2>
                    <p className="text-slate-400 mb-6">
                        There is no shift currently open to close.
                    </p>
                    <Link href="/shop">
                        <Button className="bg-emerald-600 hover:bg-emerald-700">
                            Back to Shop
                        </Button>
                    </Link>
                </div>
            </div>
        );
    }

    const shiftDuration = () => {
        const start = new Date(currentShift.opened_at);
        const now = new Date();
        const hours = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60));
        const minutes = Math.floor(((now.getTime() - start.getTime()) % (1000 * 60 * 60)) / (1000 * 60));
        return `${hours}h ${minutes}m`;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-slate-900 to-slate-900 p-6">
            <div className="max-w-lg mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <Link href="/shop">
                        <Button variant="ghost" className="text-slate-400 hover:text-white mb-4">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Shop
                        </Button>
                    </Link>
                    <h1 className="text-2xl font-bold text-white mb-2">Close Shift</h1>
                    <p className="text-slate-400">End your day and record closing cash</p>
                </div>

                {/* Current Shift Info */}
                <Card className="bg-slate-800/30 border-slate-700 mb-6">
                    <CardContent className="py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-full bg-emerald-600">
                                    <Clock className="h-4 w-4 text-white" />
                                </div>
                                <div>
                                    <p className="text-sm text-slate-400">Duration</p>
                                    <p className="text-white font-medium">{shiftDuration()}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-full bg-blue-600">
                                    <Wallet className="h-4 w-4 text-white" />
                                </div>
                                <div>
                                    <p className="text-sm text-slate-400">Opening Float</p>
                                    <p className="text-white font-medium">
                                        KES {currentShift.opening_float?.toLocaleString()}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 col-span-2">
                                <div className="p-2 rounded-full bg-purple-600">
                                    <Users className="h-4 w-4 text-white" />
                                </div>
                                <div>
                                    <p className="text-sm text-slate-400">Staff on Duty</p>
                                    <p className="text-white font-medium">
                                        {currentShift.staff_on_duty?.join(", ") || "Not recorded"}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Close Form */}
                <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                            <Square className="h-5 w-5 text-red-500" />
                            Close Shift
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Closed By */}
                            <div className="space-y-2">
                                <Label htmlFor="closedBy" className="text-slate-300">
                                    Your Name *
                                </Label>
                                <Input
                                    id="closedBy"
                                    value={closedBy}
                                    onChange={(e) => setClosedBy(e.target.value)}
                                    placeholder="Enter your name"
                                    className="bg-slate-900 border-slate-600 text-white"
                                />
                            </div>

                            {/* Closing Cash */}
                            <div className="space-y-2">
                                <Label htmlFor="closingCash" className="text-slate-300">
                                    Closing Cash in Till (KES) *
                                </Label>
                                <Input
                                    id="closingCash"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={closingCash}
                                    onChange={(e) => setClosingCash(e.target.value)}
                                    placeholder="Count the cash and enter total"
                                    className="bg-slate-900 border-slate-600 text-white text-lg"
                                />
                                <p className="text-xs text-slate-500">
                                    Count all cash in the till including the opening float
                                </p>
                            </div>

                            {/* Submit */}
                            <Button
                                type="submit"
                                disabled={closeShiftMutation.isPending}
                                className="w-full bg-red-600 hover:bg-red-700"
                            >
                                {closeShiftMutation.isPending ? (
                                    "Closing..."
                                ) : (
                                    <>
                                        <Square className="h-4 w-4 mr-2" />
                                        Close Shift
                                    </>
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Reminder */}
                <p className="text-center text-sm text-slate-500 mt-4">
                    Make sure you have completed stock count before closing the shift
                </p>
            </div>
        </div>
    );
}
