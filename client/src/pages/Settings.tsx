import { MobileShell } from "@/components/layout/MobileShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, AlertCircle, Loader2, XCircle } from "lucide-react";
import { Link } from "wouter";

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: configStatus } = useQuery<{ posterpos: boolean; telegram: boolean }>({
    queryKey: ["/api/config/status"],
    queryFn: async () => {
      const res = await fetch("/api/config/status");
      if (!res.ok) throw new Error("Failed to fetch status");
      return res.json();
    },
  });

  const syncInventory = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/posterpos/sync/inventory", { method: "POST" });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to sync inventory");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Sync Complete",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
    },
    onError: (error: any) => {
      toast({
        title: "Sync Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const syncSales = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/posterpos/sync/sales", { method: "POST" });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to sync sales");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Sync Complete",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
    },
    onError: (error: any) => {
      toast({
        title: "Sync Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <MobileShell className="pb-8">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md px-4 py-4 border-b flex items-center gap-3">
        <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-secondary">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold tracking-tight">Settings</h1>
      </header>

      <main className="p-4 space-y-6">
        {/* PosterPOS Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              PosterPOS Connection
              {configStatus?.posterpos ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
            </CardTitle>
            <CardDescription>
              {configStatus?.posterpos 
                ? "Connected and ready to sync" 
                : "Configure via environment variables"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!configStatus?.posterpos ? (
              <div className="p-4 bg-yellow-50 rounded-lg space-y-2 text-sm">
                <p className="font-medium text-yellow-800">Setup Required</p>
                <p className="text-yellow-700">Add these secrets to your Replit environment:</p>
                <ul className="text-yellow-600 list-disc pl-4 space-y-1">
                  <li><code className="bg-yellow-100 px-1 rounded">POSTERPOS_API_ENDPOINT</code></li>
                  <li><code className="bg-yellow-100 px-1 rounded">POSTERPOS_API_TOKEN</code></li>
                </ul>
              </div>
            ) : (
              <div className="space-y-3">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => syncInventory.mutate()}
                  disabled={syncInventory.isPending}
                >
                  {syncInventory.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                  )}
                  Sync Inventory from PosterPOS
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => syncSales.mutate()}
                  disabled={syncSales.isPending}
                >
                  {syncSales.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                  )}
                  Sync Today's Sales
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Telegram Bot */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              Telegram Bot
              {configStatus?.telegram ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
            </CardTitle>
            <CardDescription>
              {configStatus?.telegram 
                ? "Bot is running and ready" 
                : "Configure via environment variables"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!configStatus?.telegram ? (
              <div className="p-4 bg-yellow-50 rounded-lg space-y-2 text-sm">
                <p className="font-medium text-yellow-800">Setup Required</p>
                <ol className="text-yellow-700 list-decimal pl-4 space-y-1">
                  <li>Message <strong>@BotFather</strong> on Telegram</li>
                  <li>Send <code className="bg-yellow-100 px-1 rounded">/newbot</code> and follow prompts</li>
                  <li>Add <code className="bg-yellow-100 px-1 rounded">TELEGRAM_BOT_TOKEN</code> to secrets</li>
                </ol>
              </div>
            ) : (
              <div className="p-4 bg-green-50 rounded-lg space-y-2">
                <p className="text-sm font-medium text-green-800">How to connect:</p>
                <ol className="text-sm text-green-700 space-y-1 list-decimal pl-4">
                  <li>Open your bot in Telegram</li>
                  <li>Send <code className="bg-green-100 px-1 py-0.5 rounded">/start</code> to register</li>
                  <li>You'll receive real-time notifications</li>
                </ol>
                <div className="pt-2 border-t border-green-200 mt-3">
                  <p className="text-xs text-green-600">Available commands: /report /stock /alerts /requests</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Help */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">How It Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex gap-2">
              <div className="text-lg">1️⃣</div>
              <p><strong>Connect PosterPOS</strong> - Sync inventory and sales data from your kiosk</p>
            </div>
            <div className="flex gap-2">
              <div className="text-lg">2️⃣</div>
              <p><strong>Set up Telegram Bot</strong> - Get real-time alerts on sales and low stock</p>
            </div>
            <div className="flex gap-2">
              <div className="text-lg">3️⃣</div>
              <p><strong>Manage from anywhere</strong> - View analytics, approve orders, track inventory</p>
            </div>
          </CardContent>
        </Card>
      </main>
    </MobileShell>
  );
}
