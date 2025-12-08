import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/Home";
import Settings from "@/pages/Settings";
import OwnerDashboard from "@/pages/owner/Dashboard";
import OwnerRequests from "@/pages/owner/Requests";
import OwnerPayments from "@/pages/owner/Payments";
import OwnerSales from "@/pages/owner/Sales";
import OwnerUsage from "@/pages/owner/Usage";
import StoreStock from "@/pages/store/Stock";
import StorePurchases from "@/pages/store/Purchases";
import StoreProcess from "@/pages/store/Process";
import StoreDespatch from "@/pages/store/Despatch";
import StoreReorder from "@/pages/store/StoreReorder";
import ShopStock from "@/pages/shop/Stock";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/settings" component={Settings} />
      
      {/* Owner Routes */}
      <Route path="/owner" component={OwnerDashboard} />
      <Route path="/owner/requests" component={OwnerRequests} />
      <Route path="/owner/payments" component={OwnerPayments} />
      <Route path="/owner/sales" component={OwnerSales} />
      <Route path="/owner/usage" component={OwnerUsage} />
      
      {/* Store Routes */}
      <Route path="/store" component={StoreStock} />
      <Route path="/store/purchases" component={StorePurchases} />
      <Route path="/store/process" component={StoreProcess} />
      <Route path="/store/despatch" component={StoreDespatch} />
      <Route path="/store/reorder" component={StoreReorder} />
      
      {/* Shop Routes */}
      <Route path="/shop" component={ShopStock} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
