import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  ClipboardList,
  Check,
  Sun,
  Moon,
  Save,
  Search,
  ChevronRight,
  History,
  Calculator
} from "lucide-react";
import { Link } from "wouter";
import Keypad from "@/components/Keypad";

interface CommonItem {
  id: string;
  name: string;
  unit: string;
  category: string;
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
  const [searchQuery, setSearchQuery] = useState("");
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [activeItem, setActiveItem] = useState<CommonItem | null>(null);
  const [tempValue, setTempValue] = useState("0");

  // Fetch current shift
  const { data: currentShift } = useQuery({
    queryKey: ["/api/shop/shifts/current"],
    queryFn: async () => {
      const res = await fetch("/api/shop/shifts/current");
      return res.json();
    },
  });

  // Fetch common items for counting
  const { data: items, isLoading: itemsLoading } = useQuery<CommonItem[]>({
    queryKey: ["/api/shop/stock/common-items"],
    queryFn: async () => {
      const res = await fetch("/api/shop/stock/common-items");
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch today's sessions
  const { data: todaySessions } = useQuery<StockSession[]>({
    queryKey: ["/api/shop/stock/sessions/today"],
    queryFn: async () => {
      const res = await fetch("/api/shop/stock/sessions/today");
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Save entries mutation
  const saveEntriesMutation = useMutation({
    mutationFn: async () => {
      const entriesList = Object.entries(counts)
        .map(([name, qty]) => ({
          itemName: name,
          quantity: qty,
          unit: items?.find(i => i.name === name)?.unit || "units"
        }))
        .filter(e => e.quantity > 0);

      if (entriesList.length === 0) throw new Error("No items counted");

      const res = await fetch("/api/shop/stock/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionType,
          staffName,
          entries: entriesList,
        }),
      });
      if (!res.ok) throw new Error("Failed to save entries");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Stock Saved", description: `Successfully recorded ${Object.keys(counts).length} items` });
      setCounts({});
      queryClient.invalidateQueries({ queryKey: ["/api/shop/stock/sessions/today"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const filteredItems = useMemo(() => {
    if (!items) return [];
    return items.filter(item =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [items, searchQuery]);

  const categories = useMemo(() => {
    if (!filteredItems) return [];
    const cats = new Set(filteredItems.map(i => i.category || "General"));
    return Array.from(cats);
  }, [filteredItems]);

  const openKeypad = (item: CommonItem) => {
    setActiveItem(item);
    setTempValue(counts[item.name]?.toString() || "0");
  };

  const handleKeypadSubmit = () => {
    if (activeItem) {
      setCounts({ ...counts, [activeItem.name]: parseFloat(tempValue) });
      setActiveItem(null);
    }
  };

  const hasOpeningToday = todaySessions?.some(s => s.session_type === "opening");
  const hasClosingToday = todaySessions?.some(s => s.session_type === "closing");

  const countedCount = Object.keys(counts).length;

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200">
      {/* Mobile Header / Sticky */}
      <div className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/shop">
              <Button variant="ghost" size="icon" className="text-slate-400">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">Stock Count</h1>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`h-5 text-[10px] uppercase ${sessionType === 'opening' ? 'border-amber-500 text-amber-500' : 'border-indigo-500 text-indigo-500'
                  }`}>
                  {sessionType}
                </Badge>
                <span className="text-xs text-slate-500">{staffName || 'Select Staff'}</span>
              </div>
            </div>
          </div>

          <Button
            disabled={countedCount === 0 || !staffName || !currentShift || saveEntriesMutation.isPending}
            onClick={() => saveEntriesMutation.mutate()}
            className={`${countedCount > 0 ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-800'} text-white font-bold h-10 px-6 rounded-full transition-all`}
          >
            {saveEntriesMutation.isPending ? '...' : countedCount > 0 ? `Submit (${countedCount})` : 'Submit'}
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 md:p-6 pb-32">
        {/* Configuration Section */}
        <div className="grid gap-4 md:grid-cols-2 mb-8">
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="pt-6">
              <Label className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-2 block">Count Type</Label>
              <Tabs value={sessionType} onValueChange={(v) => setSessionType(v as "opening" | "closing")}>
                <TabsList className="grid grid-cols-2 bg-slate-950 p-1 h-12">
                  <TabsTrigger
                    value="opening"
                    className="data-[state=active]:bg-amber-600 data-[state=active]:text-white rounded-lg transition-all"
                    disabled={hasOpeningToday && sessionType !== 'opening'}
                  >
                    <Sun className="h-4 w-4 mr-2" />
                    Opening
                  </TabsTrigger>
                  <TabsTrigger
                    value="closing"
                    className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-lg transition-all"
                    disabled={hasClosingToday && sessionType !== 'closing'}
                  >
                    <Moon className="h-4 w-4 mr-2" />
                    Closing
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              {(sessionType === 'opening' ? hasOpeningToday : hasClosingToday) && (
                <p className="text-[10px] text-emerald-500 mt-2 flex items-center gap-1">
                  <Check className="h-3 w-3" /> Already submitted for today
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="pt-6">
              <Label className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-2 block">Counted By</Label>
              <Input
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                placeholder="Enter your name"
                className="bg-slate-950 border-slate-700 h-11 text-white placeholder:text-slate-600 focus:ring-emerald-500"
              />
            </CardContent>
          </Card>
        </div>

        {!currentShift && (
          <div className="bg-red-900/20 border border-red-900/50 rounded-xl p-4 mb-8 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-red-900/30 flex items-center justify-center text-red-500">
              !
            </div>
            <p className="text-red-400 text-sm font-medium">No open shift. Open a shift to record stock.</p>
          </div>
        )}

        {/* Search & Stats */}
        <div className="mb-6 flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search items to count..."
              className="bg-slate-900 border-slate-800 pl-10 h-12 rounded-xl text-white"
            />
          </div>
          <div className="flex items-center gap-4 bg-slate-900 p-2 rounded-xl border border-slate-800 whitespace-nowrap">
            <div className="px-3 border-r border-slate-800">
              <p className="text-[10px] text-slate-500 uppercase font-bold">Progress</p>
              <p className="text-lg font-bold text-white">{countedCount} / {items?.length || 0}</p>
            </div>
            <div className="px-3">
              <p className="text-[10px] text-slate-500 uppercase font-bold">Remaining</p>
              <p className="text-lg font-bold text-amber-500">{(items?.length || 0) - countedCount}</p>
            </div>
          </div>
        </div>

        {/* Item List by Category */}
        <div className="space-y-8">
          {itemsLoading ? (
            <div className="p-12 text-center">
              <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-slate-500">Loading your inventory...</p>
            </div>
          ) : categories.length === 0 ? (
            <div className="p-12 text-center bg-slate-900 rounded-3xl border border-slate-800">
              <ClipboardList className="h-12 w-12 text-slate-700 mx-auto mb-4" />
              <p className="text-slate-400">No items found matching your search</p>
            </div>
          ) : (
            categories.map(category => (
              <div key={category} className="space-y-3">
                <h2 className="text-slate-400 text-xs uppercase font-extrabold tracking-[0.2em] ml-1">{category}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredItems.filter(i => (i.category || "General") === category).map(item => {
                    const count = counts[item.name];
                    const isCounted = count !== undefined;
                    return (
                      <div
                        key={item.id}
                        onClick={() => openKeypad(item)}
                        className={`group relative overflow-hidden p-4 rounded-2xl border transition-all duration-200 cursor-pointer active:scale-[0.98] ${isCounted
                          ? 'bg-emerald-900/10 border-emerald-500/50 shadow-lg shadow-emerald-500/5'
                          : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                          }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className={`font-bold transition-colors ${isCounted ? 'text-emerald-400' : 'text-white'}`}>
                              {item.name}
                            </p>
                            <p className="text-xs text-slate-500">{item.unit}</p>
                          </div>

                          <div className={`flex items-center h-12 rounded-xl px-4 transition-all ${isCounted ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/50' : 'bg-slate-950 text-slate-500 group-hover:bg-slate-800'
                            }`}>
                            <span className="text-xl font-mono font-black">{isCounted ? count : '0'}</span>
                            {!isCounted && <ChevronRight className="h-4 w-4 ml-1 opacity-50" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* History Quick View */}
        {todaySessions && todaySessions.length > 0 && (
          <div className="mt-16 pt-8 border-t border-slate-800">
            <div className="flex items-center gap-2 mb-4">
              <History className="h-4 w-4 text-slate-500" />
              <h3 className="text-slate-400 font-bold text-sm">Today's Activity</h3>
            </div>
            <div className="space-y-2">
              {todaySessions.map(session => (
                <div key={session.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-900/50 border border-slate-800">
                  <div className="flex items-center gap-3">
                    {session.session_type === 'opening' ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4 text-indigo-500" />}
                    <div>
                      <p className="text-sm font-medium text-white capitalize">{session.session_type}</p>
                      <p className="text-xs text-slate-500">{session.counted_items} items counted</p>
                    </div>
                  </div>
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-none">{session.status}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Keypad Overlay */}
      {activeItem && (
        <Keypad
          title={`Count: ${activeItem.name}`}
          unit={activeItem.unit}
          value={tempValue}
          onChange={setTempValue}
          onClose={handleKeypadSubmit}
        />
      )}
    </div>
  );
}
