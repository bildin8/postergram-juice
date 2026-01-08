import { useState } from "react";
import { Link, useLocation } from "wouter";
import { secureFetch } from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Banknote, ShieldCheck, Upload, UserCheck, Lock } from "lucide-react";

export default function CashHandover() {
    const { toast } = useToast();
    const [, setLocation] = useLocation();
    const queryClient = useQueryClient();

    // State
    const [totalCash, setTotalCash] = useState("");
    const [floatAmount, setFloatAmount] = useState("1000"); // Default float
    const [recipientPin, setRecipientPin] = useState("");
    const [mpesaCode, setMpesaCode] = useState("");
    const [method, setMethod] = useState<"physical" | "banking">("physical");

    const handoverAmount = Math.max(0, Number(totalCash) - Number(floatAmount));

    // Mutation to save handover
    const handoverMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await secureFetch("/api/shop/shifts/handover", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || "Failed to record handover");
            }

            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Handover Complete", description: "Shift can now be closed." });
            queryClient.invalidateQueries({ queryKey: ["/api/shop/shifts/current"] });
            setLocation("/shop");
        },
        onError: (err: Error) => {
            toast({ title: "Handover Failed", description: err.message, variant: "destructive" });
        }
    });

    const handleSubmit = () => {
        if (!totalCash) {
            toast({ title: "Error", description: "Enter total cash.", variant: "destructive" });
            return;
        }

        handoverMutation.mutate({
            totalCash: Number(totalCash),
            float: Number(floatAmount),
            handover: handoverAmount,
            method,
            pin: recipientPin,
            mpesaCode
        });
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-slate-900 to-slate-900 p-6 flex flex-col items-center justify-center">
            <Card className="w-full max-w-md bg-slate-900 border-slate-800 shadow-2xl">
                <CardHeader>
                    <div className="flex items-center justify-between mb-2">
                        <Link href="/shop/shift-close">
                            <Button variant="ghost" size="sm" className="text-slate-400">
                                <ArrowLeft className="h-4 w-4 mr-1" /> Back
                            </Button>
                        </Link>
                        <div className="bg-emerald-900/30 p-2 rounded-full">
                            <Banknote className="h-6 w-6 text-emerald-400" />
                        </div>
                    </div>
                    <CardTitle className="text-2xl font-bold text-white text-center">Cash Handover</CardTitle>
                    <p className="text-slate-400 text-center text-sm">Securely transfer cash to owner/bank.</p>
                </CardHeader>

                <CardContent className="space-y-6">

                    {/* Step 1: Count */}
                    <div className="space-y-4 bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                        <div className="space-y-2">
                            <Label className="text-slate-300">Total Cash in Till</Label>
                            <Input
                                type="number"
                                value={totalCash}
                                onChange={(e) => setTotalCash(e.target.value)}
                                className="bg-slate-950 border-slate-700 text-white text-lg font-bold text-right"
                                placeholder="0.00"
                            />
                        </div>
                        <div className="flex gap-4">
                            <div className="flex-1 space-y-2">
                                <Label className="text-slate-400 text-xs uppercase">Keep as Float</Label>
                                <Input
                                    type="number"
                                    value={floatAmount}
                                    onChange={(e) => setFloatAmount(e.target.value)}
                                    className="bg-slate-900 border-slate-700 text-slate-300 text-right"
                                />
                            </div>
                            <div className="flex-1 space-y-2">
                                <Label className="text-emerald-400 text-xs uppercase font-bold">To Handover</Label>
                                <div className="h-10 flex items-center justify-end px-3 bg-emerald-900/20 border border-emerald-900/50 rounded-md">
                                    <span className="text-emerald-400 font-bold text-lg">{handoverAmount.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Step 2: Method */}
                    <div className="grid grid-cols-2 gap-3">
                        <Button
                            variant={method === "physical" ? "default" : "outline"}
                            className={method === "physical" ? "bg-indigo-600 hover:bg-indigo-700" : "border-slate-700 text-slate-400"}
                            onClick={() => setMethod("physical")}
                        >
                            <UserCheck className="h-4 w-4 mr-2" />
                            In-Person
                        </Button>
                        <Button
                            variant={method === "banking" ? "default" : "outline"}
                            className={method === "banking" ? "bg-indigo-600 hover:bg-indigo-700" : "border-slate-700 text-slate-400"}
                            onClick={() => setMethod("banking")}
                        >
                            <Upload className="h-4 w-4 mr-2" />
                            M-Pesa / Bank
                        </Button>
                    </div>

                    {/* Step 3: Verification */}
                    {method === "physical" ? (
                        <div className="bg-indigo-900/20 border border-indigo-500/30 p-4 rounded-xl space-y-3">
                            <div className="flex items-center gap-2 text-indigo-300 mb-2">
                                <Lock className="h-4 w-4" />
                                <span className="font-bold text-sm">Owner Authorization</span>
                            </div>
                            <Label className="text-indigo-200/70 text-xs">Enter Partner PIN to Accept Cash</Label>
                            <Input
                                type="password"
                                maxLength={4}
                                value={recipientPin}
                                onChange={(e) => setRecipientPin(e.target.value)}
                                className="bg-slate-950 border-indigo-500/50 text-white text-center tracking-[1em] font-bold text-xl h-12"
                                placeholder="••••"
                            />
                        </div>
                    ) : (
                        <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-xl space-y-3">
                            <Label className="text-slate-300">M-Pesa Transaction Code</Label>
                            <Input
                                value={mpesaCode}
                                onChange={(e) => setMpesaCode(e.target.value.toUpperCase())}
                                className="bg-slate-950 border-slate-600 text-white placeholder:text-slate-600 uppercase"
                                placeholder="QJH..."
                            />
                        </div>
                    )}

                    <Button
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 text-lg shadow-lg shadow-emerald-900/20"
                        onClick={handleSubmit}
                        disabled={handoverMutation.isPending || handoverAmount <= 0}
                    >
                        {handoverMutation.isPending ? "Verifying..." : (
                            <>
                                <ShieldCheck className="h-5 w-5 mr-2" />
                                Complete Handover
                            </>
                        )}
                    </Button>

                </CardContent>
            </Card>
        </div>
    );
}
