import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  ClipboardList,
  Plus,
  Trash2,
  Check,
  Sun,
  Moon,
  Save
} from "lucide-react";
import { Link } from "wouter";

interface StockEntry {
  itemName: string;
  quantity: number;
  unit: string;
  notes?: string;
}

interface StockSession {
  id: string;
  session_type: string;
  status: string;
  staff_name: string;
  started_at: string;
  total_items: number;
  counted_items: number;
}

export default function ShopStock() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [sessionType, setSessionType] = useState<"opening" | "closing">("opening");
  const [staffName, setStaffName] = useState("");
  const [entries, setEntries] = useState<StockEntry[]>([
    { itemName: "", quantity: 0, unit: "units" }
  ]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Fetch current shift
  const { data: currentShift } = useQuery({
    queryKey: ["/api/shop-portal/shifts/current"],
    queryFn: async () => {
      const res = await fetch("/api/shop-portal/shifts/current");
      return res.json();
    },
  });

  // Fetch today's sessions
  const { data: todaySessions } = useQuery<StockSession[]>({
    queryKey: ["/api/shop-portal/stock/sessions/today"],
    queryFn: async () => {
      const res = await fetch("/api/shop-portal/stock/sessions/today");
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch common items for quick add
  const { data: commonItems } = useQuery({
    queryKey: ["/api/shop-portal/stock/common-items"],
    queryFn: async () => {
      const res = await fetch("/api/shop-portal/stock/common-items");
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Start session mutation
  const startSessionMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/shop-portal/stock/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionType,
          staffName,
        }),
      });
      if (!res.ok) throw new Error("Failed to start session");
      return res.json();
    },
    onSuccess: (data) => {
      setActiveSessionId(data.id);
      toast({ title: "Session Started", description: `${sessionType} stock count started` });
      queryClient.invalidateQueries({ queryKey: ["/api/shop-portal/stock/sessions/today"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to start session", variant: "destructive" });
    },
  });

  // Save entries mutation
  const saveEntriesMutation = useMutation({
    mutationFn: async () => {
      const validEntries = entries.filter(e => e.itemName && e.quantity > 0);
      if (validEntries.length === 0) throw new Error("No valid entries");

      const res = await fetch("/api/shop-portal/stock/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: activeSessionId,
          sessionType,
          staffName,
          entries: validEntries,
        }),
      });
      if (!res.ok) throw new Error("Failed to save entries");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Stock Saved", description: `${entries.filter(e => e.itemName).length} items recorded` });
      setEntries([{ itemName: "", quantity: 0, unit: "units" }]);
      setActiveSessionId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/shop-portal/stock/sessions/today"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const addEntry = () => {
    setEntries([...entries, { itemName: "", quantity: 0, unit: "units" }]);
  };

  const removeEntry = (index: number) => {
    if (entries.length > 1) {
      setEntries(entries.filter((_, i) => i !== index));
    }
  };

  const updateEntry = (index: number, field: keyof StockEntry, value: string | number) => {
    const updated = [...entries];
    updated[index] = { ...updated[index], [field]: value };
    setEntries(updated);
  };

  const addCommonItem = (itemName: string, unit: string) => {
    // Find first empty entry or add new one
    const emptyIndex = entries.findIndex(e => !e.itemName);
    if (emptyIndex >= 0) {
      updateEntry(emptyIndex, "itemName", itemName);
      updateEntry(emptyIndex, "unit", unit);
    } else {
      setEntries([...entries, { itemName, quantity: 0, unit }]);
    }
  };

  const validEntriesCount = entries.filter(e => e.itemName && e.quantity > 0).length;
  const hasOpeningToday = todaySessions?.some(s => s.session_type === "opening");
  const hasClosingToday = todaySessions?.some(s => s.session_type === "closing");

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
          <h1 className="text-2xl font-bold text-white mb-2">Stock Count</h1>
          <p className="text-slate-400">
            Record opening or closing stock levels
          </p>
        </div>

        {/* No Shift Warning */}
        {!currentShift && (
          <Card className="bg-amber-900/30 border-amber-600 mb-6">
            <CardContent className="py-4">
              <p className="text-amber-300">
                ⚠️ No open shift. Please open a shift first to record stock.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Session Type Tabs */}
        <Tabs value={sessionType} onValueChange={(v) => setSessionType(v as "opening" | "closing")} className="mb-6">
          <TabsList className="grid grid-cols-2 bg-slate-800">
            <TabsTrigger
              value="opening"
              className="data-[state=active]:bg-amber-600"
              disabled={hasOpeningToday}
            >
              <Sun className="h-4 w-4 mr-2" />
              Opening Stock
              {hasOpeningToday && <Badge className="ml-2 bg-emerald-600">Done</Badge>}
            </TabsTrigger>
            <TabsTrigger
              value="closing"
              className="data-[state=active]:bg-indigo-600"
              disabled={hasClosingToday}
            >
              <Moon className="h-4 w-4 mr-2" />
              Closing Stock
              {hasClosingToday && <Badge className="ml-2 bg-emerald-600">Done</Badge>}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Staff Name */}
        <Card className="bg-slate-800/50 border-slate-700 mb-6">
          <CardContent className="pt-6">
            <div>
              <Label className="text-slate-300">Counted By</Label>
              <Input
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                placeholder="Your name"
                className="bg-slate-900 border-slate-600 text-white"
              />
            </div>
          </CardContent>
        </Card>

        {/* Quick Add Common Items */}
        {Array.isArray(commonItems) && commonItems.length > 0 && (
          <Card className="bg-slate-800/30 border-slate-700 mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm">Quick Add</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {commonItems.slice(0, 10).map((item: any) => (
                  <Button
                    key={item.id || item.name}
                    variant="outline"
                    size="sm"
                    className="border-slate-600 text-slate-300"
                    onClick={() => addCommonItem(item.name, item.unit || "units")}
                  >
                    + {item.name}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stock Entries */}
        <Card className="bg-slate-800/50 border-slate-700 mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-emerald-500" />
              {sessionType === "opening" ? "Opening" : "Closing"} Stock Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 mb-4">
              {entries.map((entry, index) => (
                <div key={index} className="flex gap-3 items-end">
                  <div className="flex-1">
                    <Label className="text-slate-300 text-sm">Item</Label>
                    <Input
                      value={entry.itemName}
                      onChange={(e) => updateEntry(index, "itemName", e.target.value)}
                      placeholder="Item name"
                      className="bg-slate-900 border-slate-600 text-white"
                    />
                  </div>
                  <div className="w-24">
                    <Label className="text-slate-300 text-sm">Qty</Label>
                    <Input
                      type="number"
                      value={entry.quantity || ""}
                      onChange={(e) => updateEntry(index, "quantity", parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="bg-slate-900 border-slate-600 text-white"
                    />
                  </div>
                  <div className="w-24">
                    <Label className="text-slate-300 text-sm">Unit</Label>
                    <Input
                      value={entry.unit}
                      onChange={(e) => updateEntry(index, "unit", e.target.value)}
                      placeholder="units"
                      className="bg-slate-900 border-slate-600 text-white"
                    />
                  </div>
                  {entries.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-400"
                      onClick={() => removeEntry(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              className="border-slate-600 mb-6"
              onClick={addEntry}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Row
            </Button>

            {/* Summary & Save */}
            <div className="pt-4 border-t border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <span className="text-slate-400">Items to save</span>
                <Badge className="bg-emerald-600">{validEntriesCount}</Badge>
              </div>
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                disabled={!staffName || validEntriesCount === 0 || saveEntriesMutation.isPending || !currentShift}
                onClick={() => saveEntriesMutation.mutate()}
              >
                {saveEntriesMutation.isPending ? "Saving..." : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save {sessionType === "opening" ? "Opening" : "Closing"} Stock
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Today's Sessions */}
        {todaySessions && todaySessions.length > 0 && (
          <Card className="bg-slate-800/30 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white text-lg">Today's Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {todaySessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50"
                  >
                    <div className="flex items-center gap-3">
                      {session.session_type === "opening" ? (
                        <Sun className="h-5 w-5 text-amber-500" />
                      ) : (
                        <Moon className="h-5 w-5 text-indigo-500" />
                      )}
                      <div>
                        <p className="text-white capitalize">{session.session_type} Stock</p>
                        <p className="text-sm text-slate-400">
                          {session.staff_name} • {session.counted_items} items
                        </p>
                      </div>
                    </div>
                    <Badge className={session.status === "completed" ? "bg-emerald-600" : "bg-amber-600"}>
                      {session.status}
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
