import React from "react";
import { motion } from "motion/react";
import { Wallet, Sparkles, CalendarDays, Library, History } from "lucide-react";
import { cn } from "../lib/utils";

type NavigationProps = {
  activeTab: string;
  setActiveTab: (tab: string) => void;
};

export default function Navigation({
  activeTab,
  setActiveTab,
}: NavigationProps) {
  const tabs = [
    { id: "cashflow", label: "財務收支", icon: Wallet },
    { id: "wealthplan", label: "AI 增值方案", icon: Sparkles },
    { id: "tracking", label: "資產追蹤", icon: CalendarDays },
    { id: "dca", label: "定投記錄", icon: History },
    { id: "resources", label: "資源庫", icon: Library },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-2xl border-t border-white/50 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
      <div className="max-w-lg mx-auto px-6 py-3 flex justify-around items-center">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative flex flex-col items-center justify-center w-16 h-16 rounded-2xl transition-all duration-300 group",
                isActive
                  ? "text-emerald-600"
                  : "text-gray-400 hover:text-gray-600",
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute inset-0 bg-gradient-to-b from-emerald-50 to-teal-50 rounded-2xl -z-10 shadow-inner border border-emerald-100"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <div className={cn("relative p-1.5 rounded-xl transition-all duration-300", isActive ? "bg-white shadow-sm" : "group-hover:bg-gray-50")}>
                <Icon
                  className={cn(
                    "w-6 h-6 transition-all duration-300",
                    isActive ? "scale-110 text-emerald-600 fill-emerald-100" : "group-hover:scale-105"
                  )}
                  strokeWidth={isActive ? 2.5 : 2}
                />
              </div>
              <span className={cn(
                "text-[10px] font-bold tracking-wide mt-1 transition-all duration-300",
                isActive ? "text-emerald-700 translate-y-0" : "text-gray-400 group-hover:text-gray-500"
              )}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
