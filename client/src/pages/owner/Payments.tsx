import { useState } from "react";
import { MobileShell } from "@/components/layout/MobileShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Banknote, CreditCard, Loader2, Receipt, ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, addDays } from "date-fns";

type DateRange = "today" | "yesterday" | "week" | "month";

interface PaymentSummary {
  total: number;
  totalTransactions: number;
  cash: { total: number; count: number; percentage: number };
  card: { total: number; count: number; percentage: number };
  from: string;
  to: string;
}

interface PaymentTransaction {
  transaction_id: string;
  date_close: string;
  amount: number;
  table_name: string;
  method: string;
}

interface PaymentsData {
  summary: PaymentSummary;
  transactions: {
    cash: PaymentTransaction[];
    card: PaymentTransaction[];
  };
}

export default function OwnerPayments() {
  const [dateRange, setDateRange] = useState<DateRange>("today");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const getDateParams = () => {
    const formatLocalDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}${month}${day}`;
    };

    switch (dateRange) {
      case "today":
        return { from: formatLocalDate(selectedDate), to: formatLocalDate(selectedDate) };
      case "yesterday":
        const yesterday = subDays(selectedDate, 1);
        return { from: formatLocalDate(yesterday), to: formatLocalDate(yesterday) };
      case "week":
        return { from: formatLocalDate(subDays(selectedDate, 7)), to: formatLocalDate(selectedDate) };
      case "month":
        return { from: formatLocalDate(subDays(selectedDate, 30)), to: formatLocalDate(selectedDate) };
    }
  };

  const params = getDateParams();

  const { data, isLoading } = useQuery<PaymentsData>({
    queryKey: ["/api/payments", params.from, params.to],
    queryFn: async () => {
      const res = await fetch(`/api/payments?from=${params.from}&to=${params.to}`);
      if (!res.ok) throw new Error("Failed to fetch payments");
      return res.json();
    },
  });

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setSelectedDate(subDays(selectedDate, 1));
    } else {
      setSelectedDate(addDays(selectedDate, 1));
    }
  };

  return (
    <MobileShell theme="owner" className="pb-20">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md px-6 py-4 border-b">
        <h1 className="text-xl font-bold tracking-tight text-primary" data-testid="text-page-title">Payments</h1>
      </header>

      <main className="p-4 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => navigateDate('prev')}
            data-testid="button-prev-date"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center">
            <p className="font-medium" data-testid="text-current-date">{format(selectedDate, 'EEEE, MMM d')}</p>
          </div>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => navigateDate('next')}
            disabled={format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')}
            data-testid="button-next-date"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
          {[
            { key: "today", label: "Today" },
            { key: "yesterday", label: "Yesterday" },
            { key: "week", label: "7 Days" },
            { key: "month", label: "30 Days" },
          ].map(({ key, label }) => (
            <Button
              key={key}
              variant={dateRange === key ? "default" : "outline"}
              size="sm"
              className="shrink-0"
              onClick={() => setDateRange(key as DateRange)}
              data-testid={`button-range-${key}`}
            >
              {label}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <Card className="bg-primary text-primary-foreground border-none">
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-sm opacity-80">Total Sales</p>
                  <p className="text-3xl font-bold mt-1" data-testid="text-total-sales">
                    KES {data?.summary.total.toFixed(2) || "0.00"}
                  </p>
                  <p className="text-sm opacity-80 mt-1" data-testid="text-transaction-count">
                    {data?.summary.totalTransactions || 0} transactions
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-green-50 border-none">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                      <Banknote className="h-4 w-4 text-green-600" />
                    </div>
                    <span className="text-sm font-medium text-green-900">Cash</span>
                  </div>
                  <p className="text-xl font-bold text-green-900" data-testid="text-cash-total">
                    KES {data?.summary.cash.total.toFixed(2) || "0.00"}
                  </p>
                  <div className="flex justify-between text-xs text-green-700 mt-1">
                    <span data-testid="text-cash-count">{data?.summary.cash.count || 0} txns</span>
                    <span data-testid="text-cash-percentage">{data?.summary.cash.percentage.toFixed(0) || 0}%</span>
                  </div>
                  <div className="h-1.5 bg-green-200 rounded-full mt-2 overflow-hidden">
                    <div 
                      className="h-full bg-green-500 transition-all"
                      style={{ width: `${data?.summary.cash.percentage || 0}%` }}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-blue-50 border-none">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <CreditCard className="h-4 w-4 text-blue-600" />
                    </div>
                    <span className="text-sm font-medium text-blue-900">Card/M-Pesa</span>
                  </div>
                  <p className="text-xl font-bold text-blue-900" data-testid="text-card-total">
                    KES {data?.summary.card.total.toFixed(2) || "0.00"}
                  </p>
                  <div className="flex justify-between text-xs text-blue-700 mt-1">
                    <span data-testid="text-card-count">{data?.summary.card.count || 0} txns</span>
                    <span data-testid="text-card-percentage">{data?.summary.card.percentage.toFixed(0) || 0}%</span>
                  </div>
                  <div className="h-1.5 bg-blue-200 rounded-full mt-2 overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 transition-all"
                      style={{ width: `${data?.summary.card.percentage || 0}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="cash" className="w-full">
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="cash" data-testid="tab-cash">
                  Cash ({data?.transactions.cash.length || 0})
                </TabsTrigger>
                <TabsTrigger value="card" data-testid="tab-card">
                  Card/M-Pesa ({data?.transactions.card.length || 0})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="cash" className="space-y-3 mt-4">
                {!data?.transactions.cash.length ? (
                  <Card className="p-8 text-center">
                    <Banknote className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-muted-foreground">No cash transactions</p>
                  </Card>
                ) : (
                  data.transactions.cash.map((tx, idx) => (
                    <Card key={tx.transaction_id || idx} className="border-none shadow-sm">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                            <Banknote className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">Receipt #{tx.transaction_id}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(tx.date_close)} at {formatTime(tx.date_close)}
                            </p>
                          </div>
                        </div>
                        <p className="font-bold text-green-700" data-testid={`text-cash-tx-${tx.transaction_id}`}>
                          KES {tx.amount.toFixed(2)}
                        </p>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>

              <TabsContent value="card" className="space-y-3 mt-4">
                {!data?.transactions.card.length ? (
                  <Card className="p-8 text-center">
                    <CreditCard className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-muted-foreground">No card/M-Pesa transactions</p>
                  </Card>
                ) : (
                  data.transactions.card.map((tx, idx) => (
                    <Card key={tx.transaction_id || idx} className="border-none shadow-sm">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                            <CreditCard className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">Receipt #{tx.transaction_id}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(tx.date_close)} at {formatTime(tx.date_close)}
                            </p>
                          </div>
                        </div>
                        <p className="font-bold text-blue-700" data-testid={`text-card-tx-${tx.transaction_id}`}>
                          KES {tx.amount.toFixed(2)}
                        </p>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
      <BottomNav role="owner" />
    </MobileShell>
  );
}
