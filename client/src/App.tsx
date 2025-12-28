import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/Home";
import Settings from "@/pages/Settings";

// Legacy Owner Routes (kept for backward compatibility)
// Partner Portal
import PartnerHome from "@/pages/partner/PartnerHome";
import ApprovalsInbox from "@/pages/partner/ApprovalsInbox";
import Insights from "@/pages/partner/Insights";
import StaffManagement from "@/pages/partner/StaffManagement";
import StockReconciliation from "@/pages/partner/StockReconciliation";
import StockTakes from "@/pages/partner/StockTakes";
import CashReconciliation from "@/pages/partner/CashReconciliation";
import Alerts from "@/pages/partner/Alerts";
import Items from "@/pages/partner/Items";
import LocalBuys from "@/pages/partner/LocalBuys";
import MpesaPayment from "@/pages/owner/MpesaPayment";

// Store Portal
import StoreHome from "@/pages/store/StoreHome";
import ToBuy from "@/pages/store/ToBuy";
import StoreProcess from "@/pages/store/Process";
import StoreDespatch from "@/pages/store/Despatch";
import StoreStock from "@/pages/store/StoreStock";

// Shop Portal
import ShopHome from "@/pages/shop/ShopHome";
import ShopStock from "@/pages/shop/Stock";
import ShiftOpen from "@/pages/shop/ShiftOpen";
import ShiftClose from "@/pages/shop/ShiftClose";
import ShopExpenses from "@/pages/shop/Expenses";
import ReceiveDispatch from "@/pages/shop/ReceiveDispatch";
import LocalBuyTasks from "@/pages/shop/LocalBuyTasks";

import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/settings" component={Settings} />

      {/* Owner Routes (Legacy - mapped to new Partner Portal UI) */}
      <Route path="/owner" component={PartnerHome} />
      <Route path="/owner/requests" component={ApprovalsInbox} />
      <Route path="/owner/payments" component={CashReconciliation} />
      <Route path="/owner/sales" component={Insights} />
      <Route path="/owner/usage" component={StockReconciliation} />
      <Route path="/owner/analytics" component={Insights} />
      <Route path="/owner/mpesa" component={MpesaPayment} />

      {/* Store Portal Routes */}
      <Route path="/store" component={StoreHome} />
      <Route path="/store/to-buy" component={ToBuy} />
      <Route path="/store/process" component={StoreProcess} />
      <Route path="/store/despatch" component={StoreDespatch} />
      <Route path="/store/stock" component={StoreStock} />

      {/* Legacy redirects - old routes now go to new structure */}
      <Route path="/store/purchases">{() => { window.location.href = "/store/to-buy"; return null; }}</Route>
      <Route path="/store/reorder">{() => { window.location.href = "/store"; return null; }}</Route>
      <Route path="/store/stock">{() => { window.location.href = "/store"; return null; }}</Route>

      {/* Shop Portal Routes */}
      <Route path="/shop" component={ShopHome} />
      <Route path="/shop/stock" component={ShopStock} />
      <Route path="/shop/shift-open" component={ShiftOpen} />
      <Route path="/shop/shift-close" component={ShiftClose} />
      <Route path="/shop/expenses" component={ShopExpenses} />
      <Route path="/shop/receive" component={ReceiveDispatch} />
      <Route path="/shop/local-buys" component={LocalBuyTasks} />

      {/* Partner Portal Routes */}
      <Route path="/partner" component={PartnerHome} />
      <Route path="/partner/approvals" component={ApprovalsInbox} />
      <Route path="/partner/insights" component={Insights} />
      <Route path="/partner/staff" component={StaffManagement} />
      <Route path="/partner/stock-recon" component={StockReconciliation} />
      <Route path="/partner/stock-takes" component={StockTakes} />
      <Route path="/partner/cash-recon" component={CashReconciliation} />
      <Route path="/partner/alerts" component={Alerts} />
      <Route path="/partner/items" component={Items} />
      <Route path="/partner/local-buys" component={LocalBuys} />
      <Route path="/partner/mpesa" component={MpesaPayment} />

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
