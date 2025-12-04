import { MobileShell } from "@/components/layout/MobileShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Clock, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const requests = [
  { id: 1, item: "Espresso Beans", amount: "50kg", cost: "$1,200", requester: "Store Manager", time: "2h ago", status: "pending" },
  { id: 2, item: "Paper Cups (12oz)", amount: "5000 units", cost: "$450", requester: "Store Manager", time: "5h ago", status: "pending" },
  { id: 3, item: "Oat Milk", amount: "100L", cost: "$320", requester: "Barista Lead", time: "1d ago", status: "approved" },
];

export default function OwnerRequests() {
  const { toast } = useToast();

  const handleApprove = (id: number) => {
    toast({
      title: "Request Approved",
      description: `Purchase order #${1000 + id} has been generated.`,
      className: "bg-green-600 text-white border-none"
    });
  };

  return (
    <MobileShell theme="owner" className="pb-20">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md px-6 py-4 border-b">
        <h1 className="text-xl font-bold tracking-tight text-primary">Stock Requests</h1>
      </header>

      <main className="p-4 space-y-4">
        {requests.map((req) => (
          <Card key={req.id} className="overflow-hidden border-none shadow-sm ring-1 ring-border/50">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2">
                <Badge variant={req.status === 'pending' ? "secondary" : "outline"} className={req.status === 'pending' ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-100" : "text-green-600 border-green-200"}>
                  {req.status}
                </Badge>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {req.time}
                </span>
              </div>
              <div className="font-mono font-bold">{req.cost}</div>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <div className="flex items-start gap-3 mb-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-medium">{req.item}</h3>
                  <p className="text-sm text-muted-foreground">Quantity: {req.amount}</p>
                  <p className="text-xs text-muted-foreground mt-1">Requested by {req.requester}</p>
                </div>
              </div>

              {req.status === 'pending' && (
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700">
                    <X className="mr-2 h-4 w-4" /> Reject
                  </Button>
                  <Button onClick={() => handleApprove(req.id)} className="bg-green-600 hover:bg-green-700 text-white">
                    <Check className="mr-2 h-4 w-4" /> Approve
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </main>
      <BottomNav role="owner" />
    </MobileShell>
  );
}
