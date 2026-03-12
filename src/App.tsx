/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { AppProvider, useAppContext } from "./store";
import Navigation from "./components/Navigation";
import CashFlow from "./pages/CashFlow";
import WealthPlan from "./pages/WealthPlan";
import Tracking from "./pages/Tracking";
import Resources from "./pages/Resources";
import DCARecords from "./pages/DCARecords";
import { Trash2 } from "lucide-react";

const KiwiLogo = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-xl hover:scale-110 transition-transform duration-300">
    <defs>
      {/* Vibrant Flesh Gradient */}
      <radialGradient id="freshKiwiGradient" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(24 24) rotate(90) scale(22)">
        <stop offset="0.4" stopColor="#bef264" /> {/* Lime-300 */}
        <stop offset="0.85" stopColor="#65a30d" /> {/* Lime-600 */}
        <stop offset="1" stopColor="#3f6212" /> {/* Lime-800 */}
      </radialGradient>
      
      {/* Bright Gold Coin Gradient */}
      <linearGradient id="brightGoldGradient" x1="14" y1="14" x2="34" y2="34" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#fef08a" /> {/* Yellow-200 */}
        <stop offset="0.3" stopColor="#facc15" /> {/* Yellow-400 */}
        <stop offset="0.6" stopColor="#eab308" /> {/* Yellow-500 */}
        <stop offset="1" stopColor="#a16207" /> {/* Yellow-700 */}
      </linearGradient>

      {/* Coin Edge Detail */}
      <linearGradient id="coinEdge" x1="24" y1="14" x2="24" y2="34" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#ca8a04" />
        <stop offset="1" stopColor="#fefce8" />
      </linearGradient>
    </defs>

    {/* 1. Fuzzy Skin Rim */}
    <circle cx="24" cy="24" r="23" fill="#8d6e63" stroke="#5d4037" strokeWidth="1.5" />
    
    {/* 2. Vibrant Flesh */}
    <circle cx="24" cy="24" r="21" fill="url(#freshKiwiGradient)" />
    
    {/* 3. Flesh Texture (Radiating Lines) */}
    <g opacity="0.5">
      {[0, 20, 40, 60, 80, 100, 120, 140, 160, 180, 200, 220, 240, 260, 280, 300, 320, 340].map((angle, i) => (
         <path 
           key={i}
           d="M24 24 L24 6" 
           stroke="#ecfccb" 
           strokeWidth="1.5" 
           strokeLinecap="round"
           transform={`rotate(${angle} 24 24)`}
         />
      ))}
    </g>

    {/* 4. Black Seeds (High Contrast) */}
    <g>
      {[10, 30, 50, 70, 90, 110, 130, 150, 170, 190, 210, 230, 250, 270, 290, 310, 330, 350].map((angle, i) => (
        <ellipse 
          key={i}
          cx="24" cy="12" rx="1.2" ry="2.5" 
          fill="#1a2e05" 
          transform={`rotate(${angle} 24 24)`} 
        />
      ))}
    </g>

    {/* 5. Gold Coin Core */}
    {/* Outer Gold Rim */}
    <circle cx="24" cy="24" r="9.5" fill="#b45309" /> 
    {/* Main Coin Body */}
    <circle cx="24" cy="24" r="8.5" fill="url(#brightGoldGradient)" stroke="url(#coinEdge)" strokeWidth="0.5" />
    
    {/* Coin Inner Detail - Star/Sparkle */}
    <path d="M24 19L25.5 22.5L29 24L25.5 25.5L24 29L22.5 25.5L19 24L22.5 22.5L24 19Z" fill="#fef08a" fillOpacity="0.9" />
    
    {/* 6. Overall Shine/Reflection */}
    <ellipse cx="16" cy="16" rx="8" ry="4" transform="rotate(-45 16 16)" fill="white" fillOpacity="0.3" />
  </svg>
);

function Header() {
  const { clearAllData } = useAppContext();
  const [showConfirm, setShowConfirm] = useState(false);

  const handleClear = () => {
    clearAllData();
    setShowConfirm(false);
  };

  return (
    <>
      <header className="bg-white/80 backdrop-blur-2xl border-b border-white/50 sticky top-0 z-40 shadow-[0_4px_20px_rgba(0,0,0,0.03)] transition-all duration-300">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="transform group-hover:scale-105 transition-transform duration-300">
              <KiwiLogo />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-lime-700 to-emerald-800 tracking-tight font-display drop-shadow-sm">
              KW WEALTH
            </span>
            <span className="ml-2 px-2 py-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-100/80 rounded-full border border-emerald-200/50 shadow-sm backdrop-blur-sm">
              進階版
            </span>
          </div>
          <button
            onClick={() => setShowConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-rose-600 bg-rose-50/50 hover:bg-rose-100/80 rounded-xl transition-all duration-200 border border-rose-100 hover:shadow-sm hover:-translate-y-0.5"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">清空所有資料</span>
          </button>
        </div>
      </header>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm px-4">
          <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-white/50 transform transition-all scale-100">
            <h3 className="text-xl font-bold text-gray-900 mb-3">確定要清空所有資料嗎？</h3>
            <p className="text-gray-600 text-sm mb-8 leading-relaxed">
              此操作將刪除所有的收支記錄、AI 財富增值方案以及資產追蹤數據，且無法復原。
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-6 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleClear}
                className="px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 rounded-xl transition-all shadow-lg shadow-rose-200 hover:shadow-rose-300 hover:-translate-y-0.5"
              >
                確定清空
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState("cashflow");

  return (
    <AppProvider>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-emerald-50/30 font-sans text-gray-900 pb-32 selection:bg-emerald-100 selection:text-emerald-900">
        <Header />

        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          {activeTab === "cashflow" && <CashFlow />}
          {activeTab === "wealthplan" && <WealthPlan />}
          {activeTab === "tracking" && <Tracking />}
          {activeTab === "dca" && <DCARecords />}
          {activeTab === "resources" && <Resources />}
        </main>

        <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>
    </AppProvider>
  );
}
