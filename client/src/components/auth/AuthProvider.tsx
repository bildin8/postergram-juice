import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, LogOut } from "lucide-react";

interface AuthContextType {
    isAuthenticated: boolean;
    login: (pin: string) => boolean;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// The PIN is verified against an API endpoint
const STORAGE_KEY = "postergram_auth";
const SESSION_DURATION = 8 * 60 * 60 * 1000; // 8 hours

export function AuthProvider({ children }: { children: ReactNode }) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Check for existing session
        const session = localStorage.getItem(STORAGE_KEY);
        if (session) {
            try {
                const { expiry } = JSON.parse(session);
                if (new Date().getTime() < expiry) {
                    setIsAuthenticated(true);
                } else {
                    localStorage.removeItem(STORAGE_KEY);
                }
            } catch {
                localStorage.removeItem(STORAGE_KEY);
            }
        }
        setIsLoading(false);
    }, []);

    const login = (pin: string): boolean => {
        // Verify PIN against API
        // For now, we use a simple check - PIN should be configured via env
        // The backend will verify the actual PIN
        if (pin.length >= 4) {
            // Store session
            const session = {
                authenticated: true,
                expiry: new Date().getTime() + SESSION_DURATION,
                pin: pin
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
            setIsAuthenticated(true);
            return true;
        }
        return false;
    };

    const logout = () => {
        localStorage.removeItem(STORAGE_KEY);
        setIsAuthenticated(false);
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within AuthProvider");
    }
    return context;
}

export function LoginGate({ children }: { children: ReactNode }) {
    const { isAuthenticated, login } = useAuth();
    const [pin, setPin] = useState("");
    const [error, setError] = useState("");
    const [isVerifying, setIsVerifying] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsVerifying(true);

        try {
            // Verify PIN with backend
            const response = await fetch("/api/auth/verify-pin", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pin }),
            });

            const data = await response.json();

            if (data.valid) {
                login(pin);
            } else {
                setError("Invalid PIN. Please try again.");
                setPin("");
            }
        } catch {
            setError("Unable to verify. Please try again.");
        } finally {
            setIsVerifying(false);
        }
    };

    if (isAuthenticated) {
        return <>{children}</>;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
            <Card className="w-full max-w-sm border-2 border-purple-500/30 bg-slate-900/80 backdrop-blur-lg">
                <CardHeader className="text-center">
                    <div className="mx-auto w-16 h-16 bg-purple-600/20 rounded-full flex items-center justify-center mb-4">
                        <Lock className="h-8 w-8 text-purple-400" />
                    </div>
                    <CardTitle className="text-2xl font-bold text-white">PosterGram</CardTitle>
                    <p className="text-slate-400 text-sm">Enter your PIN to continue</p>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <Input
                            type="password"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            placeholder="Enter PIN"
                            value={pin}
                            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                            className="text-center text-2xl tracking-widest bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
                            maxLength={6}
                            autoFocus
                        />
                        {error && (
                            <p className="text-red-400 text-sm text-center">{error}</p>
                        )}
                        <Button
                            type="submit"
                            disabled={pin.length < 4 || isVerifying}
                            className="w-full bg-purple-600 hover:bg-purple-700 text-white py-6"
                        >
                            {isVerifying ? "Verifying..." : "Unlock"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}

export function LogoutButton() {
    const { logout } = useAuth();

    return (
        <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="text-muted-foreground hover:text-foreground"
        >
            <LogOut className="h-4 w-4 mr-1" />
            Logout
        </Button>
    );
}
