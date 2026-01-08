import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { secureFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  Users,
  Warehouse,
  Store,
  Settings,
  ArrowRight,
  Zap
} from "lucide-react";

export default function Home() {
  // Fetch pending approvals count for badge
  const { data: approvals } = useQuery({
    queryKey: ["/api/partner/approvals"],
    queryFn: async () => {
      const res = await secureFetch("/api/partner/approvals");
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 60000,
  });

  const approvalCount = approvals?.length || 0;

  const apps = [
    {
      id: "power",
      name: "Power Dashboard",
      description: "Real-time sales, usage & stock analytics",
      icon: Zap,
      color: "bg-gradient-to-br from-yellow-500 to-orange-600",
      route: "/partner/power",
      featured: true,
    },
    {
      id: "partner",
      name: "Partner Portal",
      description: "Full oversight, approvals & reconciliation",
      icon: Users,
      color: "bg-indigo-600",
      route: "/partner",
      count: approvalCount > 0 ? approvalCount : undefined,
    },
    {
      id: "store",
      name: "Store Portal",
      description: "Buy, Process & Dispatch operations",
      icon: Warehouse,
      color: "bg-emerald-600",
      route: "/store",
    },
    {
      id: "shop",
      name: "Shop Portal",
      description: "Shifts, Expenses & Stock counts",
      icon: Store,
      color: "bg-orange-600",
      route: "/shop",
    },
    {
      id: "settings",
      name: "Settings",
      description: "Configure PosterPOS & Telegram integrations",
      icon: Settings,
      color: "bg-slate-600",
      route: "/settings",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-white mb-3">PosterPOS Manager</h1>
          <p className="text-slate-400 text-lg">Complete business operations control center</p>
        </div>

        {/* Portal Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {apps.map((app) => (
            <Link key={app.id} href={app.route}>
              <Card className={`
                                bg-slate-800/50 border-slate-700 hover:bg-slate-800/80 
                                hover:border-slate-600 transition-all cursor-pointer h-full
                                ${app.featured ? "md:col-span-2 ring-2 ring-yellow-500/30" : ""}
                            `}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-xl ${app.color} shadow-lg`}>
                      <app.icon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-semibold text-white">
                        {app.featured && <span className="mr-2">⚡</span>}
                        {app.name}
                      </CardTitle>
                      <p className="text-sm text-slate-400 mt-1">{app.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {app.count !== undefined && (
                      <Badge className="bg-red-500 hover:bg-red-600 text-white">
                        {app.count}
                      </Badge>
                    )}
                    <ArrowRight className="h-5 w-5 text-slate-500" />
                  </div>
                </CardHeader>
                {app.featured && (
                  <CardContent className="pt-0">
                    <div className="flex gap-6 text-center border-t border-slate-700/50 pt-4 mt-2">
                      <div className="flex-1">
                        <p className="text-2xl font-bold text-emerald-400">Live</p>
                        <p className="text-xs text-slate-500">Sales Sync</p>
                      </div>
                      <div className="flex-1">
                        <p className="text-2xl font-bold text-blue-400">Real-time</p>
                        <p className="text-xs text-slate-500">Analytics</p>
                      </div>
                      <div className="flex-1">
                        <p className="text-2xl font-bold text-purple-400">Instant</p>
                        <p className="text-xs text-slate-500">Alerts</p>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            </Link>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="text-slate-600 text-sm">
            PosterGram • Powered by PosterPOS Integration
          </p>
        </div>
      </div>
    </div>
  );
}

