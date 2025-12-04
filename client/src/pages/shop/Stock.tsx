import { useState } from "react";
import { MobileShell } from "@/components/layout/MobileShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OpeningStock } from "@/components/shop/OpeningStock";
import { ClosingStock } from "@/components/shop/ClosingStock";
import { GoodsReceived } from "@/components/shop/GoodsReceived";
import { Expenses } from "@/components/shop/Expenses";

export default function ShopStock() {
  const [activeTab, setActiveTab] = useState("opening");

  return (
    <MobileShell theme="shop" className="pb-20">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md px-6 py-4 border-b">
        <h1 className="text-xl font-bold tracking-tight text-primary">Shop Stock</h1>
        <p className="text-sm text-muted-foreground">Daily stock management</p>
      </header>

      <main className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="grid grid-cols-4 mx-4 mt-2">
            <TabsTrigger value="opening" className="text-xs" data-testid="tab-opening">Opening</TabsTrigger>
            <TabsTrigger value="received" className="text-xs" data-testid="tab-received">Received</TabsTrigger>
            <TabsTrigger value="closing" className="text-xs" data-testid="tab-closing">Closing</TabsTrigger>
            <TabsTrigger value="expenses" className="text-xs" data-testid="tab-expenses">Expenses</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-auto p-4">
            <TabsContent value="opening" className="mt-0 h-full">
              <OpeningStock />
            </TabsContent>
            
            <TabsContent value="received" className="mt-0 h-full">
              <GoodsReceived />
            </TabsContent>
            
            <TabsContent value="closing" className="mt-0 h-full">
              <ClosingStock />
            </TabsContent>
            
            <TabsContent value="expenses" className="mt-0 h-full">
              <Expenses />
            </TabsContent>
          </div>
        </Tabs>
      </main>
      
      <BottomNav role="shop" />
    </MobileShell>
  );
}
