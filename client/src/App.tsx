import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, LoginGate } from "@/components/auth/AuthProvider";
import Home from "@/pages/Home";
import Settings from "@/pages/Settings";

// ============================================================================
// ACTIVE IMPORTS - Core Operational Pages
// ============================================================================

// Partner Portal (Active)
import PartnerHome from "@/pages/partner/PartnerHome";
import ApprovalsInbox from "@/pages/partner/ApprovalsInbox";
import StaffManagement from "@/pages/partner/StaffManagement";
import StockReconciliation from "@/pages/partner/StockReconciliation";
import StockTakes from "@/pages/partner/StockTakes";
import CashReconciliation from "@/pages/partner/CashReconciliation";
import Items from "@/pages/partner/Items";
import LocalBuys from "@/pages/partner/LocalBuys";
import PowerDashboard from "@/pages/partner/PowerDashboard";
import PartnerSettings from "@/pages/partner/PartnerSettings";
import PurchaseRequests from "@/pages/partner/PurchaseRequests";
import DispatchOrders from "@/pages/partner/DispatchOrders";
import CustomReports from "@/pages/partner/CustomReports";

// Store Portal
import StoreHome from "@/pages/store/StoreHome";
import ToBuy from "@/pages/store/ToBuy";
import StoreProcess from "@/pages/store/Process";
import StoreDespatch from "@/pages/store/Despatch";
import StoreStock from "@/pages/store/StoreStock";
import ProcessingRecipes from "@/pages/store/ProcessingRecipes";

// Shop Portal
import ShopHome from "@/pages/shop/ShopHome";
import ShopStock from "@/pages/shop/Stock";
import ShiftOpen from "@/pages/shop/ShiftOpen";
import ShiftClose from "@/pages/shop/ShiftClose";
import ShopExpenses from "@/pages/shop/Expenses";
import ReceiveDispatch from "@/pages/shop/ReceiveDispatch";
import LocalBuyTasks from "@/pages/shop/LocalBuyTasks";
import CashHandover from "@/pages/shop/CashHandover";

import NotFound from "@/pages/not-found";

// ============================================================================
// ARCHIVED IMPORTS - Preserved for future use (uncomment to restore)
// ============================================================================
// import Insights from "@/pages/_archived/Insights";
// import Profitability from "@/pages/_archived/Profitability";
// import Suppliers from "@/pages/_archived/Suppliers";
// import SupplierAnalytics from "@/pages/_archived/SupplierAnalytics";
// import SmartReplenishment from "@/pages/_archived/SmartReplenishment";
// import Alerts from "@/pages/_archived/Alerts";
// import MpesaPayment from "@/pages/_archived/MpesaPayment";
// import Analytics from "@/pages/_archived/Analytics";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/settings" component={Settings} />

      {/* ================================================================ */}
      {/* STORE PORTAL - Store Operations (Buy → Process → Despatch)     */}
      {/* ================================================================ */}
      <Route path="/store" component={StoreHome} />
      <Route path="/store/to-buy" component={ToBuy} />
      <Route path="/store/process" component={StoreProcess} />
      <Route path="/store/despatch" component={StoreDespatch} />
      <Route path="/store/stock" component={StoreStock} />
      <Route path="/store/processing" component={ProcessingRecipes} />

      {/* ================================================================ */}
      {/* SHOP PORTAL - Shop Operations (Receive → Count → Sell)          */}
      {/* ================================================================ */}
      <Route path="/shop" component={ShopHome} />
      <Route path="/shop/stock" component={ShopStock} />
      <Route path="/shop/shift-open" component={ShiftOpen} />
      <Route path="/shop/shift-close" component={ShiftClose} />
      <Route path="/shop/expenses" component={ShopExpenses} />
      <Route path="/shop/receive" component={ReceiveDispatch} />
      <Route path="/shop/local-buys" component={LocalBuyTasks} />
      <Route path="/shop/cash-handover" component={CashHandover} />

      {/* ================================================================ */}
      {/* PARTNER PORTAL - Oversight & Reconciliation                     */}
      {/* ================================================================ */}
      <Route path="/partner" component={PartnerHome} />
      <Route path="/partner/power" component={PowerDashboard} />
      <Route path="/partner/approvals" component={ApprovalsInbox} />
      <Route path="/partner/stock-recon" component={StockReconciliation} />
      <Route path="/partner/stock-takes" component={StockTakes} />
      <Route path="/partner/cash-recon" component={CashReconciliation} />
      <Route path="/partner/staff" component={StaffManagement} />
      <Route path="/partner/items" component={Items} />
      <Route path="/partner/local-buys" component={LocalBuys} />
      <Route path="/partner/settings" component={PartnerSettings} />
      <Route path="/partner/purchases" component={PurchaseRequests} />
      <Route path="/partner/dispatches" component={DispatchOrders} />
      <Route path="/partner/reports" component={CustomReports} />

      {/* ================================================================ */}
      {/* LEGACY OWNER ROUTES - Redirect to Partner Portal                */}
      {/* ================================================================ */}
      <Route path="/owner" component={PartnerHome} />
      <Route path="/owner/requests" component={ApprovalsInbox} />
      <Route path="/owner/payments" component={CashReconciliation} />
      <Route path="/owner/usage" component={StockReconciliation} />

      {/* ================================================================ */}
      {/* ARCHIVED ROUTES - Uncomment to restore                          */}
      {/* ================================================================ */}
      {/* <Route path="/partner/insights" component={Insights} /> */}
      {/* <Route path="/partner/profitability" component={Profitability} /> */}
      {/* <Route path="/partner/smart-replenishment" component={SmartReplenishment} /> */}
      {/* <Route path="/partner/suppliers" component={Suppliers} /> */}
      {/* <Route path="/partner/suppliers/:id/analytics" component={SupplierAnalytics} /> */}
      {/* <Route path="/partner/alerts" component={Alerts} /> */}
      {/* <Route path="/partner/mpesa" component={MpesaPayment} /> */}
      {/* <Route path="/owner/sales" component={Insights} /> */}
      {/* <Route path="/owner/analytics" component={Insights} /> */}
      {/* <Route path="/owner/mpesa" component={MpesaPayment} /> */}

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <LoginGate>
            <Router />
          </LoginGate>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;

