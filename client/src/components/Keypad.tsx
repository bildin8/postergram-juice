import { Button } from "@/components/ui/button";
import { X, Delete } from "lucide-react";

interface KeypadProps {
    value: string;
    onChange: (value: string) => void;
    onClose: () => void;
    title: string;
    unit?: string;
}

export default function Keypad({ value, onChange, onClose, title, unit }: KeypadProps) {
    const handleNumber = (n: string) => {
        if (value === "0" && n !== ".") {
            onChange(n);
        } else {
            if (n === "." && value.includes(".")) return;
            onChange(value + n);
        }
    };

    const handleClear = () => onChange("0");
    const handleBackspace = () => {
        if (value.length <= 1) onChange("0");
        else onChange(value.slice(0, -1));
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300">
                <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/50">
                    <div>
                        <h3 className="text-white font-bold">{title}</h3>
                        {unit && <p className="text-xs text-slate-400">Unit: {unit}</p>}
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="text-slate-400 hover:text-white">
                        <X className="h-5 w-5" />
                    </Button>
                </div>

                <div className="p-6">
                    <div className="bg-slate-950 rounded-xl p-4 mb-6 text-right">
                        <span className="text-4xl font-mono text-emerald-400 font-bold">{value}</span>
                        {unit && <span className="text-sm text-slate-500 ml-2">{unit}</span>}
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                            <Button
                                key={num}
                                variant="outline"
                                className="h-16 text-2xl font-semibold bg-slate-800 border-slate-700 hover:bg-slate-700 text-white"
                                onClick={() => handleNumber(num.toString())}
                            >
                                {num}
                            </Button>
                        ))}
                        <Button
                            variant="outline"
                            className="h-16 text-2xl font-semibold bg-slate-800 border-slate-700 hover:bg-slate-700 text-white"
                            onClick={() => handleNumber(".")}
                        >
                            .
                        </Button>
                        <Button
                            variant="outline"
                            className="h-16 text-2xl font-semibold bg-slate-800 border-slate-700 hover:bg-slate-700 text-white"
                            onClick={() => handleNumber("0")}
                        >
                            0
                        </Button>
                        <Button
                            variant="outline"
                            className="h-16 text-2xl font-semibold bg-slate-800 border-slate-700 hover:bg-red-900/30 text-red-400 border-red-900/50"
                            onClick={handleBackspace}
                        >
                            <Delete className="h-6 w-6" />
                        </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-4">
                        <Button
                            variant="outline"
                            className="h-14 bg-slate-800 border-slate-700 text-slate-300"
                            onClick={handleClear}
                        >
                            Clear
                        </Button>
                        <Button
                            className="h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-lg"
                            onClick={onClose}
                        >
                            Done
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
