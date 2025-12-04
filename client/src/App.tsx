import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/Home";
import OwnerDashboard from "@/pages/owner/Dashboard";
import StoreInventory from "@/pages/store/Inventory";
import ShopPOS from "@/pages/shop/POS";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      
      {/* Owner Routes */}
      <Route path="/owner" component={OwnerDashboard} />
      
      {/* Store Routes */}
      <Route path="/store" component={StoreInventory} />
      
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
