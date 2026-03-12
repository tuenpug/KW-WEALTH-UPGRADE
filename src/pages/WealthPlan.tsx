import React, { useState, useMemo } from "react";
import { useAppContext, AIPlan, calculateProjections } from "../store";
import { GoogleGenAI, Type } from "@google/genai";
import { motion, AnimatePresence } from "motion/react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import {
  Sparkles,
  Target,
  Clock,
  TrendingUp,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Calendar as CalendarIcon,
  FileText,
  Save,
  Trash2,
  Plus,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function WealthPlan() {
  const { state, setAIPlan } = useAppContext();
  const [years, setYears] = useState<number>(5);
  const [targetAmount, setTargetAmount] = useState<number>(1000000);
  const today = new Date();
  const [startYear, setStartYear] = useState(today.getFullYear());
  const [startMonth, setStartMonth] = useState(today.getMonth() + 1);
  const [initialCapital, setInitialCapital] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const planRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (state.aiPlan) {
      setYears(state.aiPlan.years);
      setTargetAmount(state.aiPlan.targetAmount);
      setStartYear(state.aiPlan.startYear);
      setStartMonth(state.aiPlan.startMonth);
      setInitialCapital(state.aiPlan.initialCapital || 0);
    }
  }, [state.aiPlan]);

  const generatePlan = async () => {
    setLoading(true);
    setError(null);

    try {
      // Find the effective record at the start date
      const effectiveRecord = state.records.filter(r => r.id <= `${startYear}-${String(startMonth).padStart(2, '0')}`).sort((a, b) => b.id.localeCompare(a.id))[0];
      
      const totalIncome = effectiveRecord ? effectiveRecord.income.salary + effectiveRecord.income.allowance + effectiveRecord.income.rental : 0;
      const staticExpenseTotal = effectiveRecord ? 
        effectiveRecord.expense.mortgage + effectiveRecord.expense.household + effectiveRecord.expense.utilities + 
        effectiveRecord.expense.parking + effectiveRecord.expense.tuition + effectiveRecord.expense.hobby + 
        effectiveRecord.expense.annuity + effectiveRecord.expense.tax + effectiveRecord.expense.personal : 0;
      const insuranceTotal = effectiveRecord ? effectiveRecord.expense.insurance.reduce((a, b) => a + b.amount, 0) : 0;
      const extraTotal = effectiveRecord ? effectiveRecord.expense.extra.reduce((a, b) => a + b.amount, 0) : 0;
      const totalExpense = staticExpenseTotal + insuranceTotal + extraTotal;
      const monthlySavings = totalIncome - totalExpense;

      const historicalData = state.records.map(r => {
        const inc = r.income.salary + r.income.allowance + r.income.rental;
        const exp = r.expense.mortgage + r.expense.household + r.expense.utilities + 
          r.expense.parking + r.expense.tuition + r.expense.hobby + 
          r.expense.annuity + r.expense.tax + r.expense.personal +
          r.expense.insurance.reduce((a, b) => a + b.amount, 0) +
          r.expense.extra.reduce((a, b) => a + b.amount, 0);
        return `${r.year}年${r.month}月: 收入 $${inc}, 開支 $${exp}, 可儲蓄 $${Math.max(0, inc - exp)}`;
      }).join('\n');

      const prompt = `
        作為一位專業的財富管理顧問，請根據以下用戶的財務狀況，制定一個為期 ${years} 年，目標金額為 $${targetAmount} 的財富增值計劃。
        
        用戶現況（基於 ${startYear}年${startMonth}月 數據）：
        - 現時流動資金 (Initial Capital): $${initialCapital}
        - 每月總收入 (Monthly Income): $${totalIncome}
        - 每月總開支 (Monthly Expense): $${totalExpense}
        - 每月可儲蓄金額 (Monthly Savings): $${monthlySavings}
        
        用戶歷史收支數據：
        ${historicalData}
        
        請提供一個詳細的資產配置方案，並將資金分配到不同的範疇。
        請注意：
        1. 必須包含一個名為「現金儲備／定期」的類別，用作存放初始資金及流動資金。
        2. 投資策略應隨着該年/月的收支數據來調整。例如某幾個月可存款較多，用作資產增值的金額就會更多。
        3. 請為每項投資工具列出個別期間的分佈（例如：2025年1月至2025年10月每月投入 $10000，2025年11月至2026年1月每月投入 $15000）。
        4. 請確保計劃是現實可行的。如果目標太高，請在 description 中說明並提供最佳的替代方案。
      `;

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              planSummary: {
                type: Type.STRING,
                description: "計劃的整體總結及建議 (Plan summary and advice)",
              },
              allocations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    category: {
                      type: Type.STRING,
                      description: "資產類別 (e.g., 股票, 定期)",
                    },
                    percentage: {
                      type: Type.NUMBER,
                      description: "佔總投資的百分比 (0-100)",
                    },
                    periods: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          startYear: { type: Type.NUMBER },
                          startMonth: { type: Type.NUMBER },
                          endYear: { type: Type.NUMBER },
                          endMonth: { type: Type.NUMBER },
                          amount: { type: Type.NUMBER, description: "此期間建議每月投入金額" },
                        },
                        required: ["startYear", "startMonth", "endYear", "endMonth", "amount"],
                      },
                      description: "按不同時期的收支狀況，建議的每月投入金額分佈",
                    },
                    expectedReturnRate: {
                      type: Type.NUMBER,
                      description: "預期年回報率 (%)",
                    },
                    recommendations: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: "具體市場推介或投資工具建議",
                    },
                    description: {
                      type: Type.STRING,
                      description: "此類別的投資策略說明",
                    },
                  },
                  required: [
                    "category",
                    "percentage",
                    "periods",
                    "expectedReturnRate",
                    "recommendations",
                    "description",
                  ],
                },
              },
              projectedGrowth: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    year: { type: Type.NUMBER },
                    expectedTotal: { type: Type.NUMBER },
                  },
                  required: ["year", "expectedTotal"],
                },
              },
            },
            required: ["planSummary", "allocations", "projectedGrowth"],
          },
        },
      });

      const planData = JSON.parse(response.text);

      // Transform projectedGrowth to monthly for the chart if needed, or just use yearly
      const fullPlan: AIPlan = {
        targetAmount,
        years,
        startYear,
        startMonth,
        initialCapital,
        allocations: planData.allocations,
        planSummary: planData.planSummary,
        generatedAt: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`,
      };

      setAIPlan(fullPlan);
    } catch (err) {
      console.error(err);
      setError(
        "生成計劃時發生錯誤，請稍後再試。 (Error generating plan, please try again.)",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = async () => {
    if (!planRef.current) return;
    try {
      const element = planRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: "#ffffff", // Force white background for PDF
        useCORS: true,
        logging: false,
        allowTaint: true
      });
      
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'l' : 'p',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });

      pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
      pdf.save(`wealth_plan_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error("Failed to export PDF", err);
      alert("匯出 PDF 失敗 (Failed to export PDF)");
    }
  };

  const plan = state.aiPlan;
  const [editingTickers, setEditingTickers] = React.useState<Record<string, string[]>>({});
  const [editingPercentages, setEditingPercentages] = React.useState<Record<string, number>>({});
  const [editingTickerPercentages, setEditingTickerPercentages] = React.useState<Record<string, Record<string, number>>>({});

  React.useEffect(() => {
    if (plan) {
      const initialTickers: Record<string, string[]> = {};
      const initialPercentages: Record<string, number> = {};
      const initialTickerPercentages: Record<string, Record<string, number>> = {};
      
      plan.allocations.forEach(a => {
        initialTickers[a.category] = a.tickers || [];
        initialPercentages[a.category] = a.percentage;
        initialTickerPercentages[a.category] = a.tickerPercentages || {};
        
        // If tickers exist but no percentages, distribute evenly
        if (a.tickers && a.tickers.length > 0 && Object.keys(initialTickerPercentages[a.category]).length === 0) {
          const evenPct = Math.floor(100 / a.tickers.length);
          a.tickers.forEach((t, i) => {
            initialTickerPercentages[a.category][t] = i === a.tickers.length - 1 ? 100 - (evenPct * i) : evenPct;
          });
        }
      });
      setEditingTickers(initialTickers);
      setEditingPercentages(initialPercentages);
      setEditingTickerPercentages(initialTickerPercentages);
    }
  }, [plan]);

  const handleUpdateTickers = () => {
    if (!plan) return;
    
    // Check if total category percentage is 100
    const totalCatPct: number = (Object.values(editingPercentages) as number[]).reduce((a: number, b: number) => a + b, 0);
    if (Math.abs(totalCatPct - 100) > 1) {
      alert(`類別總比例必須為 100% (目前為 ${totalCatPct}%)`);
      return;
    }
    
    // Check if total ticker percentage is 100 for each category
    for (const cat of Object.keys(editingTickers)) {
      const tickers = editingTickers[cat];
      if (tickers.length > 0) {
        const totalTickerPct = tickers.reduce((acc, t) => acc + (editingTickerPercentages[cat][t] || 0), 0);
        if (Math.abs(totalTickerPct - 100) > 1) {
          alert(`「${cat}」的股票總比例必須為 100% (目前為 ${totalTickerPct}%)`);
          return;
        }
      }
    }

    // Calculate total monthly amount per period to redistribute
    const periodTotals: Record<string, number> = {};
    plan.allocations.forEach(a => {
      a.periods.forEach(p => {
        const key = `${p.startYear}-${p.startMonth}-${p.endYear}-${p.endMonth}`;
        if (!periodTotals[key]) periodTotals[key] = 0;
        periodTotals[key] += p.amount;
      });
    });

    const updatedPlan = {
      ...plan,
      allocations: plan.allocations.map(a => {
        const newPct = editingPercentages[a.category] || 0;
        return {
          ...a,
          percentage: newPct,
          tickers: editingTickers[a.category] || [],
          tickerPercentages: editingTickerPercentages[a.category] || {},
          periods: a.periods.map(p => {
            const key = `${p.startYear}-${p.startMonth}-${p.endYear}-${p.endMonth}`;
            const totalAmount = periodTotals[key] || 0;
            return {
              ...p,
              amount: Math.round(totalAmount * (newPct / 100))
            };
          })
        };
      })
    };
    setAIPlan(updatedPlan);
    alert("已更新配置與股份！(Updated configuration and stocks)");
  };

  const dynamicProjections = useMemo(() => {
    if (!plan) return [];
    return calculateProjections(plan, state.records);
  }, [plan, state.records]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-5xl mx-auto space-y-8 pb-24"
    >
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 to-violet-700 p-8 rounded-3xl shadow-xl border border-indigo-500/30 text-white mb-8 group">
        <div className="absolute top-0 right-0 -mt-16 -mr-16 w-80 h-80 bg-white opacity-10 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-1000"></div>
        <div className="absolute bottom-0 left-0 -mb-16 -ml-16 w-64 h-64 bg-indigo-300 opacity-20 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-1000"></div>

        <div className="relative z-10 flex items-center gap-6 mb-8">
          <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-md border border-white/20 shadow-inner">
            <Target className="w-10 h-10 text-white" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2 drop-shadow-sm">
              AI 財富增值方案
            </h1>
            <p className="text-indigo-100 text-lg font-medium">
              設定目標，讓 AI 為您度身訂造專屬投資策略
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10 bg-white/10 p-6 rounded-3xl backdrop-blur-md border border-white/20 shadow-inner">
          <div className="group/input">
            <label className="block text-sm font-bold text-indigo-100 mb-2 flex items-center gap-2">
              <CalendarIcon className="w-4 h-4" /> 起始日期 (Start Date)
            </label>
            <div className="flex gap-2">
              <div className="relative w-full">
                <select 
                  value={startYear} 
                  onChange={(e) => setStartYear(Number(e.target.value))}
                  className="appearance-none bg-white/20 border border-white/30 text-white font-bold rounded-2xl focus:ring-2 focus:ring-white/50 focus:border-white block w-full px-4 py-3.5 transition-all hover:bg-white/30 cursor-pointer [&>option]:text-gray-900"
                >
                  {[...Array(10)].map((_, i) => {
                    const year = today.getFullYear() - 5 + i;
                    return <option key={year} value={year}>{year}年</option>;
                  })}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/70">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
              <div className="relative w-full">
                <select 
                  value={startMonth} 
                  onChange={(e) => setStartMonth(Number(e.target.value))}
                  className="appearance-none bg-white/20 border border-white/30 text-white font-bold rounded-2xl focus:ring-2 focus:ring-white/50 focus:border-white block w-full px-4 py-3.5 transition-all hover:bg-white/30 cursor-pointer [&>option]:text-gray-900"
                >
                  {[...Array(12)].map((_, i) => (
                    <option key={i + 1} value={i + 1}>{i + 1}月</option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/70">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>
          <div className="group/input">
            <label className="block text-sm font-bold text-indigo-100 mb-2 flex items-center gap-2">
              <Clock className="w-4 h-4" /> 財產增值年期 (Years)
            </label>
            <input
              type="number"
              value={years}
              onChange={(e) => setYears(Number(e.target.value))}
              className="bg-white/20 border border-white/30 text-white placeholder-indigo-200 text-xl font-bold rounded-2xl focus:ring-2 focus:ring-white/50 focus:border-white block w-full px-4 py-3.5 transition-all hover:bg-white/30"
              min="1"
              max="50"
            />
          </div>
          <div className="group/input">
            <label className="block text-sm font-bold text-indigo-100 mb-2 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> 目標增值金額 (Target)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-indigo-200 text-xl font-bold">
                $
              </span>
              <input
                type="number"
                value={targetAmount}
                onChange={(e) => setTargetAmount(Number(e.target.value))}
                className="pl-10 bg-white/20 border border-white/30 text-white placeholder-indigo-200 text-xl font-bold rounded-2xl focus:ring-2 focus:ring-white/50 focus:border-white block w-full px-4 py-3.5 transition-all hover:bg-white/30"
                min="0"
                step="10000"
              />
            </div>
          </div>
          <div className="group/input">
            <label className="block text-sm font-bold text-indigo-100 mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> 起始資金 (Initial Capital)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-indigo-200 text-xl font-bold">
                $
              </span>
              <input
                type="number"
                value={initialCapital}
                onChange={(e) => setInitialCapital(Number(e.target.value))}
                className="pl-10 bg-white/20 border border-white/30 text-white placeholder-indigo-200 text-xl font-bold rounded-2xl focus:ring-2 focus:ring-white/50 focus:border-white block w-full px-4 py-3.5 transition-all hover:bg-white/30"
                min="0"
                step="1000"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-6 p-4 bg-red-500/20 border border-red-500/50 text-white rounded-2xl flex items-center gap-3 relative z-10 backdrop-blur-md shadow-lg">
            <AlertCircle className="w-6 h-6 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        <button
          onClick={generatePlan}
          disabled={loading}
          className="w-full mt-8 relative z-10 flex items-center justify-center gap-3 bg-white text-indigo-700 hover:bg-indigo-50 px-8 py-4 rounded-2xl font-bold text-lg transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
        >
          {loading ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            >
              <Sparkles className="w-6 h-6" />
            </motion.div>
          ) : (
            <Sparkles className="w-6 h-6" />
          )}
          {loading ? "AI 正在為您運算最佳方案..." : "生成 AI 財富增值方案"}
        </button>
      </div>

      {plan && !loading && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-8"
        >
          <div className="flex justify-end">
             <button
               onClick={handleExportPDF}
               className="flex items-center gap-2 px-6 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200"
             >
               <FileText className="w-4 h-4" /> 匯出 PDF
             </button>
          </div>

          <div ref={planRef} className="space-y-8 p-4 bg-white/50 rounded-3xl backdrop-blur-sm">
            {/* Summary */}
            <div className="bg-gradient-to-br from-indigo-900 to-violet-900 p-8 rounded-3xl shadow-xl text-white relative overflow-hidden border border-indigo-500/30 group">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity duration-500">
              <Target className="w-48 h-48" />
            </div>
            <h2 className="text-2xl font-bold mb-6 relative z-10 flex items-center gap-3">
              <div className="bg-white/10 p-2 rounded-xl backdrop-blur-sm">
                <Sparkles className="w-6 h-6" />
              </div>
              AI 策略總結
            </h2>
            <div className="relative z-10 bg-white/5 p-6 rounded-2xl backdrop-blur-sm border border-white/10">
              <p className="text-indigo-50 text-lg leading-relaxed font-medium">
                {plan.planSummary}
              </p>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-lg border border-white/50">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <div className="bg-indigo-100 p-2 rounded-xl">
                <TrendingUp className="w-6 h-6 text-indigo-600" />
              </div>
              預期財富增長軌跡 (Projected Growth)
            </h2>
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dynamicProjections}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#f3f4f6"
                  />
                  <XAxis
                    dataKey="monthIndex"
                    tickFormatter={(val) => `第${Math.ceil(val / 12)}年`}
                    interval={11}
                    stroke="#9ca3af"
                    tick={{fontSize: 12}}
                  />
                  <YAxis
                    tickFormatter={(val) => `$${(val / 10000).toFixed(0)}萬`}
                    stroke="#9ca3af"
                    tick={{fontSize: 12}}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                    formatter={(value: number) => [
                      `$${value.toLocaleString()}`,
                      "預期總資產",
                    ]}
                    labelFormatter={(label) =>
                      `第 ${Math.ceil(label / 12)} 年 ${((label - 1) % 12) + 1} 月`
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="expectedTotal"
                    stroke="#6366f1"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorTotal)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Allocations */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2 px-2">
              資產配置建議 (Asset Allocation)
            </h2>
            {plan.allocations.map((alloc, idx) => (
              <motion.div
                key={idx}
                className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-lg border border-white/50 overflow-hidden hover:shadow-xl transition-all duration-300"
                initial={false}
              >
                <div
                  className="p-6 cursor-pointer flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-white/50 transition-colors"
                  onClick={() =>
                    setExpandedCategory(
                      expandedCategory === alloc.category
                        ? null
                        : alloc.category,
                    )
                  }
                >
                  <div className="flex items-center gap-5">
                    <div 
                      className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-200 flex items-center justify-center text-indigo-700 font-bold text-xl shadow-inner relative overflow-hidden"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="number"
                        value={editingPercentages[alloc.category] !== undefined ? editingPercentages[alloc.category] : alloc.percentage}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setEditingPercentages(prev => ({ ...prev, [alloc.category]: val }));
                        }}
                        className="w-full h-full bg-transparent text-center focus:outline-none focus:bg-white/50"
                        min="0"
                        max="100"
                      />
                      <span className="absolute right-1 text-sm pointer-events-none">%</span>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 mb-1">
                        {alloc.category}
                      </h3>
                      <p className="text-sm text-gray-500 font-medium">
                        預期年回報:{" "}
                        <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-md">
                          {alloc.expectedReturnRate}%
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="text-right">
                      <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">每月建議投入</p>
                      <p className="text-xl font-bold text-indigo-600">
                        依時期變動
                      </p>
                    </div>
                    <div className={`p-2 rounded-full bg-gray-100 transition-transform duration-300 ${expandedCategory === alloc.category ? 'rotate-180 bg-indigo-100 text-indigo-600' : 'text-gray-400'}`}>
                      <ChevronDown className="w-6 h-6" />
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {expandedCategory === alloc.category && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-gray-100 bg-gray-50/50"
                    >
                      <div className="p-6 space-y-6">
                        <div>
                          <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <CalendarIcon className="w-5 h-5 text-indigo-500" />
                            建議投入金額分佈 (Investment Distribution)
                          </h4>
                          <div className="space-y-3">
                            {alloc.periods.map((period, pIdx) => (
                              <div key={pIdx} className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                <span className="text-gray-600 font-medium">
                                  {period.startYear}年{period.startMonth}月 - {period.endYear}年{period.endMonth}月
                                </span>
                                <span className="font-bold text-indigo-600 text-lg">
                                  ${period.amount.toLocaleString()} <span className="text-sm text-gray-400 font-normal">/ 月</span>
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        <div className="bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100">
                          <h4 className="font-bold text-indigo-900 mb-3">策略說明</h4>
                          <p className="text-gray-700 leading-relaxed font-medium">
                            {alloc.description}
                          </p>
                        </div>

                        <div className="bg-white p-6 rounded-2xl border border-indigo-100 shadow-sm">
                          <h4 className="font-bold text-indigo-900 mb-4 flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-indigo-500" />{" "}
                            最新市場推介 (Market Recommendations)
                          </h4>
                          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {alloc.recommendations.map((rec, rIdx) => (
                              <li key={rIdx} className="flex items-start gap-2 text-gray-700 font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-2 shrink-0" />
                                {rec}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Ticker Configuration */}
                        {alloc.category !== "現金儲備／定期" && alloc.category !== "流動資金及定期存款" && (
                          <div className="bg-white p-6 rounded-2xl border border-indigo-100 shadow-sm mt-4">
                            <h4 className="font-bold text-indigo-900 mb-4 flex items-center gap-2">
                              <Target className="w-5 h-5 text-indigo-500" />{" "}
                              配置具體股份 (Configure Specific Stocks)
                            </h4>
                            <div className="space-y-3">
                              {(editingTickers[alloc.category] || []).map((ticker, tIdx) => {
                                const tickerPct = editingTickerPercentages[alloc.category]?.[ticker] || 0;
                                const firstPeriodAmount = plan.allocations.reduce((sum, a) => sum + (a.periods[0]?.amount || 0), 0) * ((editingPercentages[alloc.category] ?? alloc.percentage) / 100);
                                const previewAmount = Math.round(firstPeriodAmount * (tickerPct / 100));
                                
                                return (
                                <div key={tIdx} className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={ticker}
                                    onChange={(e) => {
                                      const newTickers = [...(editingTickers[alloc.category] || [])];
                                      const oldTicker = newTickers[tIdx];
                                      const newTicker = e.target.value.toUpperCase();
                                      newTickers[tIdx] = newTicker;
                                      
                                      setEditingTickers(prev => ({ ...prev, [alloc.category]: newTickers }));
                                      
                                      if (oldTicker !== newTicker) {
                                        setEditingTickerPercentages(prev => {
                                          const catPcts = { ...prev[alloc.category] };
                                          catPcts[newTicker] = catPcts[oldTicker] || 0;
                                          delete catPcts[oldTicker];
                                          return { ...prev, [alloc.category]: catPcts };
                                        });
                                      }
                                    }}
                                    placeholder="e.g. 0700.HK"
                                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-bold text-gray-900"
                                  />
                                  <div className="relative w-24">
                                    <input
                                      type="number"
                                      value={tickerPct}
                                      onChange={(e) => {
                                        const val = parseInt(e.target.value) || 0;
                                        setEditingTickerPercentages(prev => ({
                                          ...prev,
                                          [alloc.category]: {
                                            ...(prev[alloc.category] || {}),
                                            [ticker]: val
                                          }
                                        }));
                                      }}
                                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-bold text-gray-900 text-right pr-8"
                                      min="0"
                                      max="100"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">%</span>
                                  </div>
                                  <div className="w-32 text-right text-sm font-bold text-indigo-600 bg-indigo-50 py-2 px-3 rounded-xl border border-indigo-100">
                                    約 ${previewAmount.toLocaleString()}
                                  </div>
                                  <button
                                    onClick={() => {
                                      const newTickers = [...(editingTickers[alloc.category] || [])];
                                      const removedTicker = newTickers.splice(tIdx, 1)[0];
                                      setEditingTickers(prev => ({ ...prev, [alloc.category]: newTickers }));
                                      
                                      setEditingTickerPercentages(prev => {
                                        const catPcts = { ...prev[alloc.category] };
                                        delete catPcts[removedTicker];
                                        return { ...prev, [alloc.category]: catPcts };
                                      });
                                    }}
                                    className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors shrink-0"
                                  >
                                    <Trash2 className="w-5 h-5" />
                                  </button>
                                </div>
                              )})}
                              <button
                                onClick={() => {
                                  const newTickers = [...(editingTickers[alloc.category] || []), ""];
                                  setEditingTickers(prev => ({ ...prev, [alloc.category]: newTickers }));
                                }}
                                className="flex items-center gap-2 text-indigo-600 font-bold hover:text-indigo-700 transition-colors mt-2"
                              >
                                <Plus className="w-4 h-4" /> 新增股份 (Add Stock)
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>

          <div className="flex justify-center pt-4">
            <button
              onClick={handleUpdateTickers}
              className="flex items-center gap-2 px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 hover:scale-[1.02]"
            >
              <Save className="w-5 h-5" /> 更新股份配置 (Update Stock Configuration)
            </button>
          </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
