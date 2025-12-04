import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, Loader2, Plus, Receipt, ShoppingCart, Users, Car, Building, Wallet, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ExpenseItem {
  itemName: string;
  quantity: number;
  unit: string;
  costPerUnit?: number;
}

interface Expense {
  id: string;
  expenseType: string;
  category?: string;
  description: string;
  amount: string;
  paidBy: string;
  paidTo?: string;
  createdAt: string;
  items?: ExpenseItem[];
}

const PETTY_CASH_CATEGORIES = [
  { value: "staff", label: "Staff", icon: Users },
  { value: "transport", label: "Transport", icon: Car },
  { value: "directors", label: "Directors", icon: Building },
  { value: "mall_bills", label: "Mall Bills", icon: Receipt },
  { value: "other", label: "Other", icon: Wallet },
];

export function Expenses() {
  const [expenseType, setExpenseType] = useState<"supermarket" | "petty_cash">("supermarket");
  const [isAdding, setIsAdding] = useState(false);
  
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [paidTo, setPaidTo] = useState("");
  const [category, setCategory] = useState("");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [expenseItems, setExpenseItems] = useState<ExpenseItem[]>([]);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: todayData, isLoading } = useQuery({
    queryKey: ["/api/shop/expenses/today"],
    queryFn: async () => {
      const res = await fetch("/api/shop/expenses/today");
      return res.json();
    },
  });

  const { data: allExpenses = [] } = useQuery<Expense[]>({
    queryKey: ["/api/shop/expenses"],
    queryFn: async () => {
      const res = await fetch("/api/shop/expenses");
      return res.json();
    },
  });

  const createExpenseMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/shop/expenses", {
        expenseType,
        category: expenseType === "petty_cash" ? category : undefined,
        description,
        amount,
        paidBy,
        paidTo: expenseType === "petty_cash" ? paidTo : undefined,
        receiptNumber,
        notes,
        items: expenseType === "supermarket" ? expenseItems : undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Expense recorded" });
      queryClient.invalidateQueries({ queryKey: ["/api/shop/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shop/expenses/today"] });
      resetForm();
    },
    onError: () => {
      toast({ title: "Failed to create expense", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setDescription("");
    setAmount("");
    setPaidBy("");
    setPaidTo("");
    setCategory("");
    setReceiptNumber("");
    setNotes("");
    setExpenseItems([]);
    setIsAdding(false);
  };

  const addExpenseItem = () => {
    setExpenseItems([...expenseItems, { itemName: "", quantity: 1, unit: "units" }]);
  };

  const removeExpenseItem = (index: number) => {
    setExpenseItems(expenseItems.filter((_, i) => i !== index));
  };

  const updateExpenseItem = (index: number, field: keyof ExpenseItem, value: string | number) => {
    const updated = [...expenseItems];
    updated[index] = { ...updated[index], [field]: value };
    setExpenseItems(updated);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isAdding) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {expenseType === "supermarket" ? "Supermarket Purchase" : "Petty Cash"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={expenseType} onValueChange={(v) => setExpenseType(v as "supermarket" | "petty_cash")}>
              <TabsList className="grid grid-cols-2">
                <TabsTrigger value="supermarket">
                  <ShoppingCart className="h-4 w-4 mr-1" /> Supermarket
                </TabsTrigger>
                <TabsTrigger value="petty_cash">
                  <Wallet className="h-4 w-4 mr-1" /> Petty Cash
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {expenseType === "petty_cash" && (
              <div>
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger data-testid="select-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {PETTY_CASH_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        <div className="flex items-center gap-2">
                          <cat.icon className="h-4 w-4" />
                          {cat.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={expenseType === "supermarket" ? "e.g., Fruit supplies" : "e.g., Staff lunch allowance"}
                data-testid="input-description"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="amount">Amount (KES)</Label>
                <Input
                  id="amount"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  data-testid="input-amount"
                />
              </div>
              <div>
                <Label htmlFor="paidBy">Paid By</Label>
                <Input
                  id="paidBy"
                  value={paidBy}
                  onChange={(e) => setPaidBy(e.target.value)}
                  placeholder="Your name"
                  data-testid="input-paid-by"
                />
              </div>
            </div>

            {expenseType === "petty_cash" && (
              <div>
                <Label htmlFor="paidTo">Paid To</Label>
                <Input
                  id="paidTo"
                  value={paidTo}
                  onChange={(e) => setPaidTo(e.target.value)}
                  placeholder="Recipient name"
                  data-testid="input-paid-to"
                />
              </div>
            )}

            {expenseType === "supermarket" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Items (link to stock)</Label>
                  <Button size="sm" variant="outline" onClick={addExpenseItem}>
                    <Plus className="h-3 w-3 mr-1" /> Add Item
                  </Button>
                </div>

                {expenseItems.map((item, index) => (
                  <Card key={index} className="p-3">
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Input
                          placeholder="Item name"
                          value={item.itemName}
                          onChange={(e) => updateExpenseItem(index, "itemName", e.target.value)}
                          data-testid={`input-expense-item-${index}`}
                        />
                        <Button size="icon" variant="ghost" onClick={() => removeExpenseItem(index)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Quantity</Label>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateExpenseItem(index, "quantity", Number(e.target.value))}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Cost/Unit</Label>
                          <Input
                            type="number"
                            value={item.costPerUnit || ""}
                            onChange={(e) => updateExpenseItem(index, "costPerUnit", Number(e.target.value))}
                            placeholder="0"
                          />
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            <div>
              <Label htmlFor="receiptNumber">Receipt Number (optional)</Label>
              <Input
                id="receiptNumber"
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value)}
                placeholder="e.g., RCP-001"
                data-testid="input-receipt"
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={resetForm}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={() => createExpenseMutation.mutate()}
                disabled={!description || !amount || !paidBy || createExpenseMutation.isPending}
                data-testid="button-save-expense"
              >
                {createExpenseMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <DollarSign className="h-4 w-4 mr-2" />
                )}
                Save Expense
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="bg-primary text-primary-foreground border-none">
        <CardContent className="p-4">
          <p className="text-sm opacity-80">Today's Expenses</p>
          <p className="text-3xl font-bold">KES {todayData?.total?.toLocaleString() || 0}</p>
          {todayData?.byCategory && Object.keys(todayData.byCategory).length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {Object.entries(todayData.byCategory).map(([cat, amt]) => (
                <span key={cat} className="text-xs bg-white/20 px-2 py-1 rounded">
                  {cat}: KES {Number(amt).toLocaleString()}
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Button
        className="w-full"
        onClick={() => setIsAdding(true)}
        data-testid="button-add-expense"
      >
        <Plus className="h-4 w-4 mr-2" />
        Record Expense
      </Button>

      {allExpenses.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase">Recent</h3>
          {allExpenses.slice(0, 10).map((expense) => {
            const CategoryIcon = PETTY_CASH_CATEGORIES.find(c => c.value === expense.category)?.icon || Receipt;
            return (
              <Card key={expense.id} data-testid={`card-expense-${expense.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        expense.expenseType === "supermarket" ? "bg-green-100 text-green-600" : "bg-blue-100 text-blue-600"
                      }`}>
                        {expense.expenseType === "supermarket" ? (
                          <ShoppingCart className="h-5 w-5" />
                        ) : (
                          <CategoryIcon className="h-5 w-5" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{expense.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {expense.paidBy} • {new Date(expense.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <p className="font-bold text-red-600">
                      -KES {Number(expense.amount).toLocaleString()}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {allExpenses.length === 0 && (
        <Card className="p-8 text-center">
          <DollarSign className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-muted-foreground">No expenses recorded yet</p>
        </Card>
      )}
    </div>
  );
}
