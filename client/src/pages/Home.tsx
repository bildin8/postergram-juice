import { Link } from "wouter";
import { MobileShell } from "@/components/layout/MobileShell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  const apps = [
    {
      id: "partner",
      name: "Partner Portal",
      description: "Full visibility & approvals",
      initial: "PA",
      color: "bg-indigo-500",
      route: "/partner",
      notifications: 0,
    },
    {
      id: "store",
      name: "Store Portal",
      description: "Buy, Process & Dispatch",
      initial: "ST",
      color: "bg-emerald-500",
      route: "/store",
      notifications: 0,
    },
    {
      id: "shop",
      name: "Shop Portal",
      description: "Shifts, Expenses & Stock",
      initial: "SH",
      color: "bg-orange-500",
      route: "/shop",
      notifications: 0,
    },
    {
      id: "owner",
      name: "Owner Dashboard",
      description: "Sales analytics (legacy)",
      initial: "OW",
      color: "bg-blue-500",
      route: "/owner",
      notifications: 0,
    },
    {
      id: "settings",
      name: "Settings",
      description: "Configure PosterPOS & Telegram",
      initial: "⚙️",
      color: "bg-gray-600",
      route: "/settings",
      notifications: 0,
    },
  ];

  return (
    <MobileShell className="bg-[#1c2631] text-white">
      <header className="flex items-center justify-between bg-[#242f3d] px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-lg font-semibold">PosterPOS Manager</span>
          </div>
        </div>
        <div className="h-8 w-8 rounded-full bg-blue-500/20 p-1.5 text-blue-500">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
        </div>
      </header>

      <div className="flex flex-col">
        {apps.map((app) => (
          <Link key={app.id} href={app.route} className="flex items-center gap-3 border-b border-white/5 bg-[#1c2631] px-4 py-3 hover:bg-[#242f3d] transition-colors">
            <Avatar className="h-12 w-12 border-2 border-[#1c2631]">
              <AvatarFallback className={`${app.color} text-white font-bold`}>{app.initial}</AvatarFallback>
            </Avatar>
            <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">{app.name}</span>
                <span className="text-xs text-gray-400">12:30 PM</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="truncate text-sm text-gray-400">{app.description}</span>
                {app.notifications > 0 && (
                  <Badge className="h-5 min-w-[1.25rem] rounded-full bg-blue-500 px-1 text-xs hover:bg-blue-600 border-none">
                    {app.notifications}
                  </Badge>
                )}
              </div>
            </div>
          </Link>
        ))}

        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 border-b border-white/5 px-4 py-3 opacity-50">
            <Avatar className="h-12 w-12 bg-gray-700">
              <AvatarFallback className="bg-gray-700 text-gray-400">U{i}</AvatarFallback>
            </Avatar>
            <div className="flex flex-1 flex-col gap-0.5">
              <div className="h-4 w-24 rounded bg-gray-700/50" />
              <div className="h-3 w-48 rounded bg-gray-700/30" />
            </div>
          </div>
        ))}
      </div>
    </MobileShell>
  );
}
