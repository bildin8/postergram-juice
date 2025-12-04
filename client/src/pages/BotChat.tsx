import { useState, useEffect, useRef } from "react";
import { MobileShell } from "@/components/layout/MobileShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, Bot, Zap, Package, DollarSign } from "lucide-react";
import { Link } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type Message = {
  id: number;
  text: string;
  sender: "bot" | "user";
  time: string;
  type?: "sale" | "alert" | "info";
};

export default function BotChat() {
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, text: "Connected to PosterPOS API ✅", sender: "bot", time: "10:00 AM", type: "info" },
    { id: 2, text: "Listening for sales and inventory events...", sender: "bot", time: "10:00 AM", type: "info" },
  ]);
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Simulate realtime events
  useEffect(() => {
    const events = [
      { text: "💰 New Sale: #1024 - $12.50\n2x Cappuccino, 1x Croissant", type: "sale", delay: 2000 },
      { text: "⚠️ Stock Alert: Oat Milk is running low (4 units left)", type: "alert", delay: 5000 },
      { text: "💰 New Sale: #1025 - $4.50\n1x Latte (Oat)", type: "sale", delay: 8000 },
      { text: "📉 Inventory Update: Oat Milk -300ml", type: "info", delay: 8500 },
    ];

    let timeouts: NodeJS.Timeout[] = [];

    events.forEach((event, index) => {
      const timeout = setTimeout(() => {
        setMessages(prev => [...prev, {
          id: Date.now() + index,
          text: event.text,
          sender: "bot",
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: event.type as any
        }]);
      }, event.delay);
      timeouts.push(timeout);
    });

    return () => timeouts.forEach(clearTimeout);
  }, []);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const userMsg = {
      id: Date.now(),
      text: inputValue,
      sender: "user" as const,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue("");

    // Simulate bot response to commands
    setTimeout(() => {
      let responseText = "I didn't understand that command.";
      const lowerInput = inputValue.toLowerCase();
      
      if (lowerInput.includes("sales") || lowerInput.includes("report")) {
        responseText = "📊 **Today's Summary:**\nTotal Sales: $452.50\nOrders: 42\nTop Item: Latte";
      } else if (lowerInput.includes("stock") || lowerInput.includes("inventory")) {
        responseText = "📦 **Stock Status:**\nAll systems normal.\nLow: Oat Milk, Vanilla Syrup";
      }

      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        text: responseText,
        sender: "bot",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: "info"
      }]);
    }, 1000);
  };

  return (
    <MobileShell className="flex flex-col h-screen bg-[#0e1621]">
      {/* Chat Header */}
      <header className="flex items-center gap-3 bg-[#17212b] p-3 text-white shadow-sm z-10">
        <Link href="/">
          <Button variant="ghost" size="icon" className="text-gray-300 hover:text-white hover:bg-white/10 rounded-full -ml-2">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <Avatar className="h-10 w-10 bg-blue-500">
          <AvatarFallback className="bg-blue-500 text-white">
            <Bot className="h-6 w-6" />
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <span className="font-semibold text-sm">PosterPOS Bot</span>
          <span className="text-xs text-blue-400">bot</span>
        </div>
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0e1621] bg-[url('https://w.wallhaven.cc/full/lq/wallhaven-lqwg92.png')] bg-fixed bg-cover bg-blend-overlay bg-opacity-10">
         {messages.map((msg) => (
           <div
             key={msg.id}
             className={cn(
               "flex w-full",
               msg.sender === "user" ? "justify-end" : "justify-start"
             )}
           >
             <div
               className={cn(
                 "max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-sm relative",
                 msg.sender === "user" 
                   ? "bg-[#2b5278] text-white rounded-tr-none" 
                   : "bg-[#182533] text-white rounded-tl-none"
               )}
             >
               {/* Icon indicators for bot messages */}
               {msg.sender === "bot" && msg.type === "sale" && <DollarSign className="h-4 w-4 text-green-400 inline-block mr-1 mb-0.5" />}
               {msg.sender === "bot" && msg.type === "alert" && <Zap className="h-4 w-4 text-yellow-400 inline-block mr-1 mb-0.5" />}
               
               <div className="whitespace-pre-wrap">{msg.text}</div>
               <div className={cn(
                 "text-[10px] mt-1 text-right opacity-50",
                 msg.sender === "user" ? "text-blue-200" : "text-gray-400"
               )}>
                 {msg.time}
               </div>
             </div>
           </div>
         ))}
         <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-[#17212b] p-2 flex items-center gap-2">
        <form onSubmit={handleSend} className="flex-1 flex items-center gap-2">
          <Input 
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type a command..." 
            className="bg-[#0e1621] border-none text-white placeholder:text-gray-500 focus-visible:ring-1 focus-visible:ring-blue-500/50"
          />
          <Button type="submit" size="icon" className="bg-blue-500 hover:bg-blue-600 text-white rounded-full h-10 w-10 shrink-0">
            <Send className="h-5 w-5 pl-0.5" />
          </Button>
        </form>
      </div>
    </MobileShell>
  );
}
