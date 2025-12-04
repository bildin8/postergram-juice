import { MobileShell } from "@/components/layout/MobileShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpRight, Truck, Calendar, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function StoreDespatch() {
  const { toast } = useToast();

  const handleDespatch = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: "Despatch Recorded",
      description: "Inventory has been updated successfully.",
      className: "bg-emerald-600 text-white border-none"
    });
  };

  return (
    <MobileShell theme="store" className="pb-20">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md px-6 py-4 border-b">
        <h1 className="text-xl font-bold tracking-tight text-primary">Despatch</h1>
      </header>

      <main className="p-4 space-y-6">
        {/* New Despatch Form */}
        <Card className="border-none shadow-md">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Truck className="h-4 w-4" />
              </div>
              <h2 className="font-semibold">Log Outgoing Stock</h2>
            </div>
            
            <form onSubmit={handleDespatch} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="item">Item</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select item..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beans">Espresso Beans</SelectItem>
                    <SelectItem value="cups">Paper Cups (12oz)</SelectItem>
                    <SelectItem value="milk">Oat Milk</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="qty">Quantity</Label>
                  <Input id="qty" type="number" placeholder="0" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="dest">Destination</Label>
                  <Select defaultValue="shop">
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="shop">Shop Floor</SelectItem>
                      <SelectItem value="waste">Waste/Spoilage</SelectItem>
                      <SelectItem value="return">Return to Vendor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white mt-2">
                Confirm Despatch
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Recent Movements Log */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">Recent Movements</h3>
          
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-white rounded-lg border border-border/50 shadow-sm">
               <div className="flex items-center gap-3">
                 <div className="bg-orange-100 p-2 rounded-full text-orange-600">
                   <ArrowUpRight className="h-4 w-4" />
                 </div>
                 <div>
                   <p className="font-medium text-sm">Espresso Beans</p>
                   <p className="text-xs text-muted-foreground">To: Shop Floor</p>
                 </div>
               </div>
               <div className="text-right">
                 <p className="font-bold text-sm">-5 kg</p>
                 <p className="text-xs text-muted-foreground">10:30 AM</p>
               </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav role="store" />
    </MobileShell>
  );
}
