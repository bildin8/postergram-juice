import { useState } from "react";
import { MobileShell } from "@/components/layout/MobileShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Plus, Minus, X, Trash2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";

const categories = ["Coffee", "Tea", "Food", "Merch"];
const products = {
  Coffee: [
    { id: 1, name: "Espresso", price: 3.50 },
    { id: 2, name: "Latte", price: 4.50 },
    { id: 3, name: "Cappuccino", price: 4.50 },
    { id: 4, name: "Americano", price: 3.75 },
    { id: 5, name: "Mocha", price: 5.00 },
  ],
  Tea: [
    { id: 6, name: "Earl Grey", price: 3.00 },
    { id: 7, name: "Green Tea", price: 3.00 },
  ],
  Food: [
    { id: 8, name: "Croissant", price: 3.50 },
    { id: 9, name: "Muffin", price: 4.00 },
  ],
  Merch: [
    { id: 10, name: "Mug", price: 15.00 },
  ]
};

export default function ShopPOS() {
  const [cart, setCart] = useState<{id: number, name: string, price: number, qty: number}[]>([]);
  const [activeCategory, setActiveCategory] = useState("Coffee");
  const [isCartOpen, setIsCartOpen] = useState(false);

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(p => p.id === product.id);
      if (existing) {
        return prev.map(p => p.id === product.id ? { ...p, qty: p.qty + 1 } : p);
      }
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const removeFromCart = (id: number) => {
    setCart(prev => prev.filter(p => p.id !== id));
  };

  const updateQty = (id: number, delta: number) => {
    setCart(prev => {
      return prev.map(p => {
        if (p.id === id) {
          const newQty = p.qty + delta;
          return newQty > 0 ? { ...p, qty: newQty } : p;
        }
        return p;
      });
    });
  };

  const total = cart.reduce((acc, curr) => acc + (curr.price * curr.qty), 0);
  const totalItems = cart.reduce((acc, curr) => acc + curr.qty, 0);

  return (
    <MobileShell theme="shop" className="flex flex-col h-screen pb-20">
      <header className="flex-none bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between shadow-md z-10">
        <h1 className="text-lg font-bold tracking-tight">Poster Shop</h1>
        <div className="flex items-center gap-2 bg-white/20 px-2 py-0.5 rounded-full text-xs backdrop-blur-sm">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span>Online</span>
        </div>
      </header>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Categories */}
        <div className="flex-none bg-background border-b p-2 shadow-sm z-0">
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex space-x-2 px-1">
              {categories.map(cat => (
                <Button
                  key={cat}
                  variant={activeCategory === cat ? "default" : "outline"}
                  onClick={() => setActiveCategory(cat)}
                  size="sm"
                  className={`rounded-full px-4 ${activeCategory === cat ? 'bg-primary text-primary-foreground' : 'bg-background border-border hover:bg-secondary'}`}
                >
                  {cat}
                </Button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Product Grid */}
        <ScrollArea className="flex-1 bg-secondary/30 p-3">
          <div className="grid grid-cols-2 gap-3 pb-4">
            {products[activeCategory as keyof typeof products].map(product => (
              <Card 
                key={product.id} 
                className="cursor-pointer border-none shadow-sm hover:shadow-md transition-all active:scale-95 bg-card"
                onClick={() => addToCart(product)}
              >
                <CardContent className="p-3 flex flex-col items-center text-center gap-2">
                  <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                    {product.name.charAt(0)}
                  </div>
                  <div className="w-full">
                    <h3 className="font-medium text-sm truncate w-full">{product.name}</h3>
                    <p className="text-primary font-bold text-sm">${product.price.toFixed(2)}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>

        {/* Mobile Cart Footer */}
        {cart.length > 0 && (
          <div className="absolute bottom-16 left-0 right-0 p-4 z-20 sm:max-w-md sm:mx-auto">
            <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
              <SheetTrigger asChild>
                <Button className="w-full h-14 text-lg shadow-xl shadow-primary/20 flex items-center justify-between px-6 rounded-xl animate-in slide-in-from-bottom-4 duration-300">
                  <div className="flex items-center gap-2">
                    <div className="bg-white/20 px-2 py-0.5 rounded text-sm font-bold min-w-[1.5rem] text-center">
                      {totalItems}
                    </div>
                    <span className="text-sm font-normal opacity-90">View Order</span>
                  </div>
                  <span className="font-bold text-xl">${total.toFixed(2)}</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[85vh] rounded-t-[20px] p-0 flex flex-col">
                <SheetHeader className="p-4 border-b">
                  <div className="flex items-center justify-between">
                    <SheetTitle>Current Order</SheetTitle>
                    <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setCart([])}>
                      Clear
                    </Button>
                  </div>
                </SheetHeader>
                
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {cart.map(item => (
                      <div key={item.id} className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-medium">{item.name}</div>
                          <div className="text-sm text-muted-foreground">${(item.price * item.qty).toFixed(2)}</div>
                        </div>
                        <div className="flex items-center gap-3 bg-secondary/50 rounded-lg p-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md bg-background shadow-sm" onClick={() => updateQty(item.id, -1)}>
                             {item.qty === 1 ? <Trash2 className="h-4 w-4 text-destructive" /> : <Minus className="h-4 w-4" />}
                          </Button>
                          <span className="w-4 text-center font-medium">{item.qty}</span>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md bg-background shadow-sm" onClick={() => updateQty(item.id, 1)}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                
                <div className="p-4 border-t bg-muted/20 space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>${total.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tax (8%)</span>
                      <span>${(total * 0.08).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold pt-2 border-t">
                      <span>Total</span>
                      <span>${(total * 1.08).toFixed(2)}</span>
                    </div>
                  </div>
                  <Button className="w-full h-12 text-lg font-bold" onClick={() => {
                    setCart([]);
                    setIsCartOpen(false);
                  }}>
                    Charge ${(total * 1.08).toFixed(2)}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        )}
      </div>
      
      <BottomNav role="shop" />
    </MobileShell>
  );
}
