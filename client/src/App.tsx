import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/Home";
import OwnerDashboard from "@/pages/owner/Dashboard";
import OwnerRequests from "@/pages/owner/Requests";
import OwnerAnalytics from "@/pages/owner/Analytics";
import StoreInventory from "@/pages/store/Inventory";
import StoreDespatch from "@/pages/store/Despatch";
import StoreReorder from "@/pages/store/Reorder";
import ShopPOS from "@/pages/shop/POS";
import BotChat from "@/pages/BotChat";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/bot" component={BotChat} />
      
      {/* Owner Routes */}
      <Route path="/owner" component={OwnerDashboard} />
      <Route path="/owner/requests" component={OwnerRequests} />
      <Route path="/owner/analytics" component={OwnerAnalytics} />
      
      {/* Store Routes */}
      <Route path="/store" component={StoreInventory} />
      <Route path="/store/despatch" component={StoreDespatch} />
      <Route path="/store/reorder" component={StoreReorder} />
      
      {/* Shop Routes */}
      <Route path="/shop" component={ShopPOS} />
      
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
