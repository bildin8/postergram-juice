import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ChefHat, Scale, ArrowRight, Save, History, AlertTriangle } from "lucide-react";

interface StoreItem {
    id: string;
    name: string;
    current_stock: string;
    unit: string;
    avg_cost?: number; // Fetched from backend if available
}

export default function ProcessingRecipes() {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // State
    const [selectedInputId, setSelectedInputId] = useState("");
    const [inputQty, setInputQty] = useState("");

    const [outputName, setOutputName] = useState("");
    const [outputQty, setOutputQty] = useState("");
    const [outputUnit, setOutputUnit] = useState("L");

    const [processorName, setProcessorName] = useState("");

    // Queries
    const { data: storeItems } = useQuery<StoreItem[]>({
        queryKey: ["/api/inventory"], // Assuming this returns store items or inventory items
        queryFn: async () => {
            const res = await fetch("/api/inventory");
            if (!res.ok) throw new Error("Failed to fetch inventory");
            return res.json();
        },
    });

    const selectedInputItem = storeItems?.find(i => i.id === selectedInputId);

    // Derived Calcs
    const currentStock = Number(selectedInputItem?.current_stock || 0);
    const isValidInput = Number(inputQty) > 0 && Number(inputQty) <= currentStock;
    const yieldPercent = (Number(inputQty) > 0 && Number(outputQty) > 0)
        ? (Number(outputQty) / Number(inputQty)) * 100
        : 0;

    // Mutation
    const processMutation = useMutation({
        mutationFn: async (data: any) => {
            // We use the existing 'despatch' or 'processed-items' endpoint but adapted
            // Since we don't have a dedicated "Production" table, we will:
            // 1. Deduct Input Item (Correction/Usage)
            // 2. Add Output Item (New Stock Enty or Processed Item)
            // For now, we'll try to use a custom endpoint or bundle it.

            // Simulating the backend logic via client for now if endpoint missing, 
            // but ideally we call POST /api/store/production

            const res = await fetch("/api/store/production", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });

            if (!res.ok) {
                // Fallback if production endpoint doesn't exist
                throw new Error("Production endpoint not implemented yet");
            }
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Production Recorded", description: "Stock updated successfully." });
            setInputQty("");
            setOutputQty("");
            setOutputName("");
            queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
        },
        onError: (err) => {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        }
    });

    const handleSubmit = () => {
        if (!selectedInputId || !inputQty || !outputName || !outputQty || !processorName) {
            toast({ title: "Missing Fields", description: "Please fill all fields.", variant: "destructive" });
            return;
        }

        processMutation.mutate({
            inputId: selectedInputId,
            inputQty: Number(inputQty),
            outputName,
            outputQty: Number(outputQty),
            outputUnit,
            processedBy: processorName,
            notes: `Yield: ${yieldPercent.toFixed(1)}%`
        });
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
            <div className="max-w-3xl mx-auto">

                {/* Header */}
                <div className="mb-8">
                    <Link href="/store">
                        <Button variant="ghost" className="text-slate-400 hover:text-white mb-4">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Store
                        </Button>
                    </Link>
                    <div className="flex items-center gap-4">
                        <div className="bg-orange-600 p-3 rounded-xl shadow-lg shadow-orange-900/20">
                            <ChefHat className="h-8 w-8 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">Production Mode</h1>
                            <p className="text-slate-400">Transform raw materials into finished goods.</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-6 items-start">

                    {/* INPUT CARD */}
                    <Card className="bg-slate-800/50 border-slate-700 md:h-[400px]">
                        <CardContent className="p-6 space-y-4">
                            <div className="flex items-center gap-2 text-orange-400 mb-2">
                                <Scale className="h-5 w-5" />
                                <h3 className="font-bold text-lg">Input (Raw)</h3>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-slate-300">Select Item</Label>
                                <Select value={selectedInputId} onValueChange={setSelectedInputId}>
                                    <SelectTrigger className="bg-slate-900 border-slate-600 text-white">
                                        <SelectValue placeholder="Choose raw material..." />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-700 text-white">
                                        {storeItems?.map(item => (
                                            <SelectItem key={item.id} value={item.id}>
                                                {item.name} ({item.current_stock} {item.unit})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-slate-300">Quantity Used</Label>
                                <div className="flex gap-2">
                                    <Input
                                        type="number"
                                        value={inputQty}
                                        onChange={(e) => setInputQty(e.target.value)}
                                        className={`bg-slate-900 border-slate-600 text-white ${Number(inputQty) > currentStock ? 'border-red-500' : ''}`}
                                        placeholder="0.00"
                                    />
                                    <div className="bg-slate-700/50 flex items-center px-3 rounded text-slate-400 text-sm font-bold">
                                        {selectedInputItem?.unit || "Unit"}
                                    </div>
                                </div>
                                {Number(inputQty) > currentStock && (
                                    <p className="text-xs text-red-400 flex items-center gap-1">
                                        <AlertTriangle className="h-3 w-3" /> Exceeds Stock ({currentStock})
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* ARROW */}
                    <div className="hidden md:flex flex-col items-center justify-center h-full pt-32 text-slate-500">
                        <ArrowRight className="h-8 w-8" />
                    </div>

                    {/* OUTPUT CARD */}
                    <Card className="bg-slate-800/50 border-slate-700 md:h-[400px]">
                        <CardContent className="p-6 space-y-4">
                            <div className="flex items-center gap-2 text-emerald-400 mb-2">
                                <History className="h-5 w-5" />
                                <h3 className="font-bold text-lg">Output (Finished)</h3>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-slate-300">Product Name</Label>
                                <Input
                                    value={outputName}
                                    onChange={(e) => setOutputName(e.target.value)}
                                    placeholder="e.g. Watermelon Juice"
                                    className="bg-slate-900 border-slate-600 text-white"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-slate-300">Quantity Produced</Label>
                                <div className="flex gap-2">
                                    <Input
                                        type="number"
                                        value={outputQty}
                                        onChange={(e) => setOutputQty(e.target.value)}
                                        className="bg-slate-900 border-slate-600 text-white"
                                        placeholder="0.00"
                                    />
                                    <Select value={outputUnit} onValueChange={setOutputUnit}>
                                        <SelectTrigger className="w-[80px] bg-slate-700/50 border-slate-600 text-white">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-900">
                                            <SelectItem value="L">L</SelectItem>
                                            <SelectItem value="Kg">Kg</SelectItem>
                                            <SelectItem value="Unit">Unit</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Yield Indicator */}
                            {(Number(inputQty) > 0 && Number(outputQty) > 0) && (
                                <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-700 mt-4">
                                    <p className="text-xs text-slate-400 uppercase font-bold text-center mb-1">Estimated Yield</p>
                                    <div className="flex items-center justify-center gap-2">
                                        <span className="text-2xl font-bold text-white">{yieldPercent.toFixed(0)}%</span>
                                        {yieldPercent > 100 && <Badge className="bg-amber-600">High</Badge>}
                                        {yieldPercent < 50 && <Badge className="bg-red-600">Low</Badge>}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                </div>

                {/* Footer Actions */}
                <div className="mt-8 bg-slate-800 p-6 rounded-xl border border-slate-700 flex items-center justify-between">
                    <div className="w-1/3">
                        <Label className="text-slate-300">Processed By</Label>
                        <Input
                            value={processorName}
                            onChange={(e) => setProcessorName(e.target.value)}
                            placeholder="Enter your name"
                            className="mt-1 bg-slate-900 border-slate-600 text-white"
                        />
                    </div>

                    <Button
                        size="lg"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-8"
                        onClick={handleSubmit}
                        disabled={processMutation.isPending || !isValidInput}
                    >
                        {processMutation.isPending ? "Processing..." : (
                            <>
                                <Save className="h-5 w-5 mr-2" />
                                Confirm Production
                            </>
                        )}
                    </Button>
                </div>

            </div>
        </div>
    );
}
