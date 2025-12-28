import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
    ArrowLeft,
    Receipt,
    Plus,
    Trash2,
    Check
} from "lucide-react";
import { Link } from "wouter";

interface ExpenseItem {
    description: string;
    amount: number;
}

export default function ShopExpenses() {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [expenseType, setExpenseType] = useState<"supermarket" | "petty_cash">("supermarket");
    const [items, setItems] = useState<ExpenseItem[]>([{ description: "", amount: 0 }]);
    const [category, setCategory] = useState("other");
    const [notes, setNotes] = useState("");
    const [recordedBy, setRecordedBy] = useState("");

    // Fetch today's expenses
    const { data: todaysExpenses } = useQuery({
        queryKey: ["/api/shop-portal/expenses/today"],
        queryFn: async () => {
            const res = await fetch("/api/shop-portal/expenses/today");
            return res.json();
        },
    });

    // Submit expense
    const submitMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/shop-portal/expenses", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: expenseType,
                    items: expenseType === "supermarket" ? items : undefined,
                    category: expenseType === "petty_cash" ? category : undefined,
                    amount: expenseType === "petty_cash" ? items[0]?.amount : undefined,
                    description: expenseType === "petty_cash" ? items[0]?.description : undefined,
                    notes,
                    recordedBy,
                }),
            });

            if (!res.ok) {
                throw new Error("Failed to record expense");
            }

            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Expense Recorded", description: "Expense has been saved." });
            queryClient.invalidateQueries({ queryKey: ["/api/shop-portal/expenses/today"] });
            setItems([{ description: "", amount: 0 }]);
            setNotes("");
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });

    const addItem = () => {
        setItems([...items, { description: "", amount: 0 }]);
    };

    const removeItem = (index: number) => {
        if (items.length > 1) {
            setItems(items.filter((_, i) => i !== index));
        }
    };

    const updateItem = (index: number, field: keyof ExpenseItem, value: string | number) => {
        const updated = [...items];
        updated[index] = { ...updated[index], [field]: value };
        setItems(updated);
    };

    const total = items.reduce((sum, item) => sum + (item.amount || 0), 0);
    const todaysTotal = Array.isArray(todaysExpenses)
        ? todaysExpenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0)
        : 0;

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
                    <h1 className="text-2xl font-bold text-white mb-2">Log Expense</h1>
                    <p className="text-slate-400">
                        Today's total: KES {todaysTotal.toLocaleString()}
                    </p>
                </div>

                {/* Expense Type Selector */}
                <div className="flex gap-3 mb-6">
                    <Button
                        variant={expenseType === "supermarket" ? "default" : "outline"}
                        className={expenseType === "supermarket" ? "bg-emerald-600" : "border-slate-600"}
                        onClick={() => setExpenseType("supermarket")}
                    >
                        Supermarket
                    </Button>
                    <Button
                        variant={expenseType === "petty_cash" ? "default" : "outline"}
                        className={expenseType === "petty_cash" ? "bg-emerald-600" : "border-slate-600"}
                        onClick={() => setExpenseType("petty_cash")}
                    >
                        Petty Cash
                    </Button>
                </div>

                {/* Form */}
                <Card className="bg-slate-800/50 border-slate-700 mb-6">
                    <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                            <Receipt className="h-5 w-5 text-emerald-500" />
                            {expenseType === "supermarket" ? "Supermarket Receipt" : "Petty Cash Expense"}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {expenseType === "supermarket" ? (
                            /* Multi-line items for supermarket */
                            <div className="space-y-3 mb-4">
                                {items.map((item, index) => (
                                    <div key={index} className="flex gap-3 items-end">
                                        <div className="flex-1">
                                            <Label className="text-slate-300 text-sm">Item</Label>
                                            <Input
                                                value={item.description}
                                                onChange={(e) => updateItem(index, "description", e.target.value)}
                                                placeholder="Item description"
                                                className="bg-slate-900 border-slate-600 text-white"
                                            />
                                        </div>
                                        <div className="w-32">
                                            <Label className="text-slate-300 text-sm">Amount</Label>
                                            <Input
                                                type="number"
                                                value={item.amount || ""}
                                                onChange={(e) => updateItem(index, "amount", parseFloat(e.target.value) || 0)}
                                                placeholder="KES"
                                                className="bg-slate-900 border-slate-600 text-white"
                                            />
                                        </div>
                                        {items.length > 1 && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-red-400"
                                                onClick={() => removeItem(index)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-slate-600"
                                    onClick={addItem}
                                >
                                    <Plus className="h-4 w-4 mr-1" />
                                    Add Item
                                </Button>
                            </div>
                        ) : (
                            /* Single entry for petty cash */
                            <div className="space-y-4 mb-4">
                                <div>
                                    <Label className="text-slate-300">Category</Label>
                                    <Select value={category} onValueChange={setCategory}>
                                        <SelectTrigger className="bg-slate-900 border-slate-600 text-white">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="transport">Transport</SelectItem>
                                            <SelectItem value="utilities">Utilities</SelectItem>
                                            <SelectItem value="cleaning">Cleaning</SelectItem>
                                            <SelectItem value="office">Office Supplies</SelectItem>
                                            <SelectItem value="other">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label className="text-slate-300">Description</Label>
                                    <Input
                                        value={items[0]?.description || ""}
                                        onChange={(e) => updateItem(0, "description", e.target.value)}
                                        placeholder="What was this for?"
                                        className="bg-slate-900 border-slate-600 text-white"
                                    />
                                </div>
                                <div>
                                    <Label className="text-slate-300">Amount (KES)</Label>
                                    <Input
                                        type="number"
                                        value={items[0]?.amount || ""}
                                        onChange={(e) => updateItem(0, "amount", parseFloat(e.target.value) || 0)}
                                        placeholder="0"
                                        className="bg-slate-900 border-slate-600 text-white"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Common fields */}
                        <div className="space-y-4 border-t border-slate-700 pt-4">
                            <div>
                                <Label className="text-slate-300">Recorded By</Label>
                                <Input
                                    value={recordedBy}
                                    onChange={(e) => setRecordedBy(e.target.value)}
                                    placeholder="Your name"
                                    className="bg-slate-900 border-slate-600 text-white"
                                />
                            </div>
                            <div>
                                <Label className="text-slate-300">Notes (optional)</Label>
                                <Textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Any additional notes"
                                    className="bg-slate-900 border-slate-600 text-white"
                                />
                            </div>
                        </div>

                        {/* Total & Submit */}
                        <div className="mt-6 pt-4 border-t border-slate-700">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-slate-400">Total</span>
                                <span className="text-2xl font-bold text-emerald-400">
                                    KES {total.toLocaleString()}
                                </span>
                            </div>
                            <Button
                                className="w-full bg-emerald-600 hover:bg-emerald-700"
                                disabled={!recordedBy || total <= 0 || submitMutation.isPending}
                                onClick={() => submitMutation.mutate()}
                            >
                                {submitMutation.isPending ? "Saving..." : (
                                    <>
                                        <Check className="h-4 w-4 mr-2" />
                                        Record Expense
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Today's Expenses */}
                {Array.isArray(todaysExpenses) && todaysExpenses.length > 0 && (
                    <Card className="bg-slate-800/30 border-slate-700">
                        <CardHeader>
                            <CardTitle className="text-white text-lg">Today's Expenses</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {todaysExpenses.map((expense: any) => (
                                    <div
                                        key={expense.id}
                                        className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50"
                                    >
                                        <div>
                                            <p className="text-white">{expense.type}</p>
                                            <p className="text-sm text-slate-400">
                                                {new Date(expense.created_at).toLocaleTimeString()}
                                            </p>
                                        </div>
                                        <Badge className="bg-emerald-600">
                                            KES {expense.amount?.toLocaleString()}
                                        </Badge>
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
