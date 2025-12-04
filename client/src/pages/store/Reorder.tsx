import { useState } from "react";
import { MobileShell } from "@/components/layout/MobileShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, AlertTriangle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export default function StoreReorder() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    itemName: "",
    quantity: "",
    unit: "kg",
    vendor: "",
    estimatedCost: "",
    notes: "",
    requester: "Store Manager",
  });

  const createRequest = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create request");
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Request Sent",
        description: "Owner has been notified for approval.",
        className: "bg-blue-600 text-white border-none"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
      setTimeout(() => setLocation("/store"), 1500);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.itemName || !formData.quantity) {
      toast({
        title: "Missing Fields",
        description: "Please fill in item name and quantity.",
        variant: "destructive",
      });
      return;
    }
    createRequest.mutate(formData);
  };

  const estimatedCostNum = parseFloat(formData.estimatedCost) || 0;

  return (
    <MobileShell theme="store" className="pb-20">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md px-6 py-4 border-b">
        <h1 className="text-xl font-bold tracking-tight text-primary">Request Stock</h1>
      </header>

      <main className="p-4">
        <Card className="border-none shadow-md">
           {estimatedCostNum > 500 && (
             <div className="bg-yellow-50 border-b border-yellow-100 p-3 flex items-start gap-2 text-sm text-yellow-800">
               <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
               <p>Orders over $500 require Owner approval.</p>
             </div>
           )}

          <CardContent className="p-5 pt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="vendor">Vendor</Label>
                <Select value={formData.vendor} onValueChange={(v) => setFormData(prev => ({ ...prev, vendor: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select vendor..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local">Local Roasters Co.</SelectItem>
                    <SelectItem value="dairy">City Dairy Supplies</SelectItem>
                    <SelectItem value="pack">EcoPackaging Solutions</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="item">Item Name *</Label>
                <Input 
                  id="item" 
                  placeholder="e.g. Espresso Blend" 
                  value={formData.itemName}
                  onChange={(e) => setFormData(prev => ({ ...prev, itemName: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="qty">Quantity *</Label>
                  <Input 
                    id="qty" 
                    type="number" 
                    placeholder="0" 
                    value={formData.quantity}
                    onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="unit">Unit</Label>
                  <Select value={formData.unit} onValueChange={(v) => setFormData(prev => ({ ...prev, unit: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kg">kg</SelectItem>
                      <SelectItem value="L">L</SelectItem>
                      <SelectItem value="units">units</SelectItem>
                      <SelectItem value="box">box</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="cost">Estimated Cost ($)</Label>
                <Input 
                  id="cost" 
                  type="number" 
                  placeholder="0.00" 
                  value={formData.estimatedCost}
                  onChange={(e) => setFormData(prev => ({ ...prev, estimatedCost: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="notes">Notes</Label>
                <Textarea 
                  id="notes" 
                  placeholder="Urgency, specific batch, etc." 
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>

              <div className="pt-2">
                <Button 
                  type="submit" 
                  className="w-full bg-primary hover:bg-primary/90 text-white flex items-center justify-center gap-2"
                  disabled={createRequest.isPending}
                >
                  {createRequest.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</>
                  ) : (
                    <><Send className="h-4 w-4" /> Send Request</>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
      <BottomNav role="store" />
    </MobileShell>
  );
}
