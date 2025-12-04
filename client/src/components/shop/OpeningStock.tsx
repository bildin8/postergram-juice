import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, ChevronLeft, ChevronRight, Loader2, Package, Play, RotateCcw } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface InventoryItem {
  id: string;
  name: string;
  posterPosId: string;
  unit: string;
  currentStock: string;
}

interface StockEntry {
  id: string;
  itemName: string;
  quantity: string;
  unit: string;
}

interface StockSession {
  id: string;
  status: string;
  staffName: string;
  totalItems: number;
  countedItems: number;
  completedAt?: string;
}

export function OpeningStock() {
  const [staffName, setStaffName] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentQty, setCurrentQty] = useState("");
  const [session, setSession] = useState<StockSession | null>(null);
  const [entries, setEntries] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: sessionData, isLoading: loadingSession } = useQuery({
    queryKey: ["/api/shop/stock/session/opening"],
    queryFn: async () => {
      const res = await fetch("/api/shop/stock/session/opening", { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
  });

  const { data: items = [], isLoading: loadingItems } = useQuery<InventoryItem[]>({
    queryKey: ["/api/shop/stock/items"],
    queryFn: async () => {
      const res = await fetch("/api/shop/stock/items", { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
  });

  useEffect(() => {
    if (sessionData?.session) {
      setSession(sessionData.session);
      if (sessionData.entries) {
        const entryMap: Record<string, string> = {};
        sessionData.entries.forEach((e: StockEntry) => {
          entryMap[e.itemName] = e.quantity;
        });
        setEntries(entryMap);
        setCurrentIndex(sessionData.entries.length);
      }
    }
  }, [sessionData]);

  const startSessionMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/shop/stock/session", { sessionType: "opening", staffName });
      return res.json();
    },
    onSuccess: (data) => {
      setSession(data.session);
      if (data.resumed) {
        toast({ title: "Resumed existing session" });
        const entryMap: Record<string, string> = {};
        data.entries?.forEach((e: StockEntry) => {
          entryMap[e.itemName] = e.quantity;
        });
        setEntries(entryMap);
        setCurrentIndex(data.entries?.length || 0);
      } else {
        toast({ title: "Opening stock started" });
      }
    },
    onError: () => {
      toast({ title: "Failed to start session", variant: "destructive" });
    },
  });

  const saveEntryMutation = useMutation({
    mutationFn: async (item: InventoryItem) => {
      const res = await apiRequest("POST", "/api/shop/stock/entry", {
        sessionId: session?.id,
        itemName: item.name,
        quantity: currentQty,
        unit: item.unit,
        inventoryItemId: item.id,
        posterPosId: item.posterPosId,
      });
      return res.json();
    },
    onSuccess: (_, item) => {
      setEntries({ ...entries, [item.name]: currentQty });
      setCurrentQty("");
      if (currentIndex < items.length - 1) {
        setCurrentIndex(currentIndex + 1);
      }
    },
    onError: () => {
      toast({ title: "Failed to save entry", variant: "destructive" });
    },
  });

  const completeSessionMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/shop/stock/session/${session?.id}/complete`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Opening stock completed!" });
      queryClient.invalidateQueries({ queryKey: ["/api/shop/stock/session/opening"] });
    },
    onError: () => {
      toast({ title: "Failed to complete session", variant: "destructive" });
    },
  });

  const handleNext = () => {
    if (!currentQty || !items[currentIndex]) return;
    saveEntryMutation.mutate(items[currentIndex]);
  };

  const handleSkip = () => {
    if (currentIndex < items.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setCurrentQty("");
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      const prevItem = items[currentIndex - 1];
      setCurrentQty(entries[prevItem.name] || "");
    }
  };

  const handleComplete = () => {
    completeSessionMutation.mutate();
  };

  const progress = items.length > 0 ? (Object.keys(entries).length / items.length) * 100 : 0;
  const currentItem = items[currentIndex];
  const isCompleted = session?.status === "completed";

  if (loadingSession || loadingItems) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isCompleted) {
    return (
      <Card className="bg-green-50 border-green-200">
        <CardContent className="p-6 text-center">
          <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-green-800">Opening Stock Completed</h3>
          <p className="text-sm text-green-600 mt-1">
            Completed at {session?.completedAt ? new Date(session.completedAt).toLocaleTimeString() : "today"}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            {Object.keys(entries).length} items counted
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!session) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Start Opening Stock
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="staffName">Your Name</Label>
            <Input
              id="staffName"
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
              placeholder="Enter your name"
              data-testid="input-staff-name"
            />
          </div>
          <Button
            className="w-full"
            onClick={() => startSessionMutation.mutate()}
            disabled={!staffName || startSessionMutation.isPending}
            data-testid="button-start-opening"
          >
            {startSessionMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Start Counting
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            You'll go through {items.length} items one by one
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4">
          <div className="flex justify-between text-sm mb-2">
            <span>Progress</span>
            <span className="font-medium">{Object.keys(entries).length} / {items.length}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </CardContent>
      </Card>

      {currentItem && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">
                Item {currentIndex + 1} of {items.length}
              </span>
              {entries[currentItem.name] && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                  Counted: {entries[currentItem.name]}
                </span>
              )}
            </div>
            <CardTitle className="text-lg">{currentItem.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="qty">Quantity ({currentItem.unit})</Label>
              <Input
                id="qty"
                type="number"
                inputMode="decimal"
                value={currentQty}
                onChange={(e) => setCurrentQty(e.target.value)}
                placeholder="Enter quantity"
                className="text-2xl h-14 text-center"
                autoFocus
                data-testid="input-quantity"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                onClick={handlePrev}
                disabled={currentIndex === 0}
                data-testid="button-prev"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                onClick={handleNext}
                disabled={!currentQty || saveEntryMutation.isPending}
                data-testid="button-next"
              >
                {saveEntryMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Save <ChevronRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                onClick={handleSkip}
                disabled={currentIndex === items.length - 1}
                data-testid="button-skip"
              >
                Skip
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {Object.keys(entries).length === items.length && items.length > 0 && (
        <Button
          className="w-full"
          size="lg"
          onClick={handleComplete}
          disabled={completeSessionMutation.isPending}
          data-testid="button-complete-opening"
        >
          {completeSessionMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <CheckCircle className="h-4 w-4 mr-2" />
          )}
          Complete Opening Stock
        </Button>
      )}

      {Object.keys(entries).length > 0 && Object.keys(entries).length < items.length && (
        <p className="text-xs text-center text-muted-foreground">
          {items.length - Object.keys(entries).length} items remaining
        </p>
      )}
    </div>
  );
}
