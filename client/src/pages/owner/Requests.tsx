import { MobileShell } from "@/components/layout/MobileShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Clock, Package, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ReorderRequest } from "@shared/schema";

export default function OwnerRequests() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: requests = [], isLoading } = useQuery<ReorderRequest[]>({
    queryKey: ["/api/requests"],
    queryFn: async () => {
      const res = await fetch("/api/requests");
      if (!res.ok) throw new Error("Failed to fetch requests");
      return res.json();
    },
  });

  const updateRequest = useMutation({
    mutationFn: async ({ id, status, approvedBy }: { id: string; status: string; approvedBy?: string }) => {
      const res = await fetch(`/api/requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, approvedBy }),
      });
      if (!res.ok) throw new Error("Failed to update request");
      return res.json();
    },
    onSuccess: (_, variables) => {
      toast({
        title: variables.status === "approved" ? "Request Approved" : "Request Rejected",
        description: `Order has been ${variables.status}.`,
        className: variables.status === "approved" ? "bg-green-600 text-white border-none" : "",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleApprove = (id: string) => {
    updateRequest.mutate({ id, status: "approved", approvedBy: "Owner" });
  };

  const handleReject = (id: string) => {
    updateRequest.mutate({ id, status: "rejected" });
  };

  const formatTime = (date: Date | string) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    return "Just now";
  };

  return (
    <MobileShell theme="owner" className="pb-20">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md px-6 py-4 border-b">
        <h1 className="text-xl font-bold tracking-tight text-primary">Stock Requests</h1>
      </header>

      <main className="p-4 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Package className="h-12 w-12 mb-2 opacity-50" />
            <p className="text-sm">No reorder requests</p>
          </div>
        ) : (
          requests.map((req) => (
            <Card key={req.id} className="overflow-hidden border-none shadow-sm ring-1 ring-border/50">
              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-2">
                  <Badge 
                    variant={req.status === 'pending' ? "secondary" : "outline"} 
                    className={
                      req.status === 'pending' ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-100" : 
                      req.status === 'approved' ? "text-green-600 border-green-200" :
                      "text-red-600 border-red-200"
                    }
                  >
                    {req.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {formatTime(req.createdAt)}
                  </span>
                </div>
                {req.estimatedCost && (
                  <div className="font-mono font-bold">${req.estimatedCost}</div>
                )}
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <div className="flex items-start gap-3 mb-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <Package className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-medium">{req.itemName}</h3>
                    <p className="text-sm text-muted-foreground">Quantity: {req.quantity} {req.unit}</p>
                    {req.vendor && <p className="text-xs text-muted-foreground mt-1">Vendor: {req.vendor}</p>}
                    <p className="text-xs text-muted-foreground">Requested by {req.requester}</p>
                    {req.notes && <p className="text-xs text-muted-foreground/70 mt-1">"{req.notes}"</p>}
                  </div>
                </div>

                {req.status === 'pending' && (
                  <div className="grid grid-cols-2 gap-3">
                    <Button 
                      variant="outline" 
                      className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => handleReject(req.id)}
                      disabled={updateRequest.isPending}
                    >
                      <X className="mr-2 h-4 w-4" /> Reject
                    </Button>
                    <Button 
                      onClick={() => handleApprove(req.id)} 
                      className="bg-green-600 hover:bg-green-700 text-white"
                      disabled={updateRequest.isPending}
                    >
                      {updateRequest.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <><Check className="mr-2 h-4 w-4" /> Approve</>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </main>
      <BottomNav role="owner" />
    </MobileShell>
  );
}
