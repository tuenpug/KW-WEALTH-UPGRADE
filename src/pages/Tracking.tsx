import React, { useState, useMemo } from "react";
import { useAppContext, AIPlan, ActualRecord, calculateProjections } from "../store";
import { motion, AnimatePresence } from "motion/react";
import {
  Calendar as CalendarIcon,
  Target,
  TrendingUp,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Save,
  Sparkles,
} from "lucide-react";
import {
  format,
  addMonths,
  subMonths,
  startOfYear,
  endOfYear,
  eachMonthOfInterval,
  isSameMonth,
} from "date-fns";
import { zhHK } from "date-fns/locale";

export default function Tracking() {
  const { state, addOrUpdateActual } = useAppContext();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedMonth, setSelectedMonth] = useState<Date | null>(null);
  const [actualTotal, setActualTotal] = useState<number>(0);
  const [actualAllocations, setActualAllocations] = useState<
    { category: string; amount: number; price?: number }[]
  >([]);

  const plan = state.aiPlan;
  
  const categories = useMemo(() => {
    if (state.aiPlan && state.aiPlan.allocations.length > 0) {
      const cats: string[] = [];
      state.aiPlan.allocations.forEach(a => {
        if (a.tickers && a.tickers.length > 0 && a.category !== "現金儲備／定期" && a.category !== "流動資金及定期存款") {
          a.tickers.forEach(ticker => {
            if (ticker.trim()) {
              cats.push(`${a.category} - ${ticker.trim()}`);
            }
          });
        } else {
          cats.push(a.category);
        }
      });
      return cats.length > 0 ? cats : ["一般定投"];
    }
    return ["一般定投"];
  }, [state.aiPlan]);

  const currentTotalAsset = useMemo(() => {
    let totalAssetValue = 0;
    let missingPrice = false;

    // Calculate cash reserve globally
    let cashReserve = state.initialCashReserve || 0;
    state.dcaRecords.forEach(r => {
      const isRecordLiquidity = r.category === "現金儲備／定期" || r.category === "流動資金及定期存款" || (!r.category && (categories.includes("現金儲備／定期") || categories.includes("流動資金及定期存款")));
      if (isRecordLiquidity) {
        cashReserve += r.amount + (r.dividendPerShare || 0);
      } else if (r.remainder && r.remainder > 0) {
        cashReserve += r.remainder;
      }
    });
    state.tradeRecords.forEach(r => {
      if (r.type === 'sell' || r.type === 'dividend') {
        cashReserve += r.totalAmount;
      } else if (r.type === 'buy') {
        cashReserve -= r.totalAmount;
      }
    });
    totalAssetValue += cashReserve;

    categories.forEach(category => {
      const isLiquidity = category === "現金儲備／定期" || category === "流動資金及定期存款";
      if (isLiquidity) return; // Already handled globally

      const baseCategory = category.includes(" - ") ? category.split(" - ")[0] : category;
      const ticker = category.includes(" - ") ? category.split(" - ")[1] : "";
      
      const isUSStock = /^[A-Za-z]/.test(ticker);
      const exchangeRate = isUSStock ? 7.8 : 1;
      
      const categoryDCARecords = state.dcaRecords.filter(r => (r.category === baseCategory && (ticker ? r.ticker === ticker : true)) || (!r.category && baseCategory === "一般定投"));
      const categoryTradeRecords = state.tradeRecords.filter(r => (r.category === baseCategory && (ticker ? r.ticker === ticker : true)) || (!r.category && baseCategory === "一般定投"));
      
      let cumulativeShares = 0;
      let cumulativeDividends = 0;
      
      categoryDCARecords.forEach(r => {
        cumulativeShares += r.shares;
        cumulativeDividends += cumulativeShares * (r.dividendPerShare || 0);
      });
      
      categoryTradeRecords.forEach(r => {
        if (r.type === 'buy') {
          cumulativeShares += r.shares;
        } else if (r.type === 'sell') {
          cumulativeShares -= r.shares;
        } else if (r.type === 'dividend') {
          cumulativeDividends += r.price * r.shares; // In trade records, dividend is stored in price
        }
      });
      
      if (cumulativeShares > 0) {
        const lastRecord = categoryDCARecords.length > 0 ? categoryDCARecords[categoryDCARecords.length - 1] : null;
        const currentPrice = state.realTimePrices[category] || (lastRecord ? lastRecord.price : 0);
        
        if (!currentPrice) {
          missingPrice = true;
        } else {
          const catAssetValue = (cumulativeShares * currentPrice + cumulativeDividends) * exchangeRate;
          totalAssetValue += catAssetValue;
        }
      }
    });

    if (missingPrice) {
      return "待定 － 請輸入股票現價";
    }

    const sortedActuals = [...state.actuals].sort((a, b) => b.id.localeCompare(a.id));
    const latestActual = sortedActuals.length > 0 ? sortedActuals[0].actualTotal : 0;

    return Math.max(totalAssetValue, latestActual);
  }, [state.dcaRecords, state.tradeRecords, state.initialCashReserve, state.actuals, state.realTimePrices, categories]);

  const dynamicProjections = useMemo(() => {
    if (!plan) return [];
    return calculateProjections(plan, state.records);
  }, [plan, state.records]);

  const months = useMemo(() => {
    const start = startOfYear(currentDate);
    const end = endOfYear(currentDate);
    return eachMonthOfInterval({ start, end });
  }, [currentDate]);

  const getProjectionForMonth = (date: Date | null) => {
    if (!date) return null;
    if (!plan) return null;
    
    // Use plan.startYear and plan.startMonth if available, fallback to generatedAt
    let startYear = plan.startYear;
    let startMonth = plan.startMonth;
    
    if (!startYear || !startMonth) {
      const planStartStr = plan.generatedAt || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      const parts = planStartStr.split("-").map(Number);
      startYear = parts[0];
      startMonth = parts[1];
    }
    
    const startDate = new Date(startYear, startMonth - 1, 1);

    const diffMonths =
      (date.getFullYear() - startDate.getFullYear()) * 12 +
      (date.getMonth() - startDate.getMonth());

    if (diffMonths < 0 || diffMonths >= (plan.years || 0) * 12) return null;

    return dynamicProjections[diffMonths];
  };

  const getAmountForDate = (allocation: any, date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    
    if (!allocation.periods) return 0;
    
    for (const period of allocation.periods) {
      const start = period.startYear * 12 + period.startMonth;
      const end = period.endYear * 12 + period.endMonth;
      const current = year * 12 + month;
      if (current >= start && current <= end) {
        return period.amount;
      }
    }
    return 0;
  };

  const getDCASummary = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    
    const monthlyDCARecords = state.dcaRecords.filter(r => r.year === year && r.month === month);
    const monthlyTradeRecords = state.tradeRecords.filter(r => {
      const d = new Date(r.date);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    });

    const totalDCAAmount = monthlyDCARecords.reduce((acc, r) => acc + r.amount, 0);
    
    const dcaByCategory = monthlyDCARecords.reduce((acc, r) => {
      const cat = r.ticker ? `${r.category} - ${r.ticker}` : (r.category || '未分類');
      if (!acc[cat]) {
        acc[cat] = { amount: 0, price: r.price };
      }
      acc[cat].amount += r.amount;
      // Use the latest price or average price? Let's just use the last one we see
      acc[cat].price = r.price;
      
      // Also add to base category for category-level summary
      const baseCat = r.category || '未分類';
      if (r.ticker) {
        if (!acc[baseCat]) {
          acc[baseCat] = { amount: 0, price: r.price };
        }
        acc[baseCat].amount += r.amount;
      }
      
      return acc;
    }, {} as Record<string, { amount: number; price: number }>);

    return {
      totalDCAAmount,
      dcaByCategory,
      monthlyDCARecords,
      monthlyTradeRecords
    };
  };

  const getCumulativeStats = (date: Date) => {
    const targetYear = date.getFullYear();
    const targetMonth = date.getMonth() + 1;
    const targetId = format(date, "yyyy-MM");
    
    const relevantDCARecords = state.dcaRecords.filter(r => {
      if (r.year < targetYear) return true;
      if (r.year === targetYear && r.month <= targetMonth) return true;
      return false;
    });

    const relevantTradeRecords = state.tradeRecords.filter(r => {
      const d = new Date(r.date);
      if (d.getFullYear() < targetYear) return true;
      if (d.getFullYear() === targetYear && (d.getMonth() + 1) <= targetMonth) return true;
      return false;
    });

    const totalInvested = relevantDCARecords.reduce((acc, r) => acc + r.amount, 0);

    // Get actual record for the target month to check for manual prices
    const actualRecord = state.actuals.find(a => a.id === targetId);
    const manualPrices: Record<string, number> = {};
    if (actualRecord && actualRecord.actualAllocations) {
      actualRecord.actualAllocations.forEach(a => {
        if (a.price !== undefined) {
          manualPrices[a.category] = a.price;
        }
      });
    }
    // Also check current unsaved actualAllocations for live updates in modal
    actualAllocations.forEach(a => {
      if (a.price !== undefined) {
        manualPrices[a.category] = a.price;
      }
    });

    // Calculate shares and value per category
    const categories = Array.from(new Set([
      ...relevantDCARecords.map(r => r.category || '未分類'),
      ...relevantTradeRecords.map(r => r.category || '未分類'),
      ...(plan?.allocations.map(a => a.category) || [])
    ]));

    const categoryBreakdown: Record<string, { totalValue: number, shares: number, price: number, totalInvested: number, tickerDetails?: Record<string, { totalValue: number, shares: number, price: number, totalInvested: number }> }> = {};

    // Calculate dynamic cash reserve up to target month
    let cashReserve = state.initialCashReserve || 0;
    let cashReserveInvested = state.initialCashReserve || 0;
    relevantDCARecords.forEach(r => {
      if (r.category === "現金儲備／定期" || r.category === "流動資金及定期存款") {
        cashReserve += r.amount;
        cashReserveInvested += r.amount;
        if (r.dividendPerShare) cashReserve += r.dividendPerShare;
      }
      if (r.remainder) {
        cashReserve += r.remainder;
      }
    });
    relevantTradeRecords.forEach(t => {
      if (t.type === 'sell') {
        cashReserve += t.totalAmount;
      } else {
        cashReserve -= t.totalAmount;
      }
    });

    categoryBreakdown["現金儲備／定期"] = { totalValue: cashReserve, shares: cashReserve, price: 1, totalInvested: cashReserveInvested };
    categoryBreakdown["流動資金及定期存款"] = { totalValue: cashReserve, shares: cashReserve, price: 1, totalInvested: cashReserveInvested };

    let estimatedAssetValue = cashReserve;

    categories.forEach(cat => {
      if (cat === "現金儲備／定期" || cat === "流動資金及定期存款") {
        return; // Already handled in cashReserve
      }

      const catDCAs = relevantDCARecords.filter(r => (r.category || '未分類') === cat);
      const catTrades = relevantTradeRecords.filter(r => (r.category || '未分類') === cat);
      
      const tickers = Array.from(new Set([
        ...catDCAs.map(r => r.ticker || ''),
        ...catTrades.map(r => r.ticker || '')
      ]));

      let categoryTotalValue = 0;
      let categoryTotalShares = 0;
      let categoryTotalInvested = 0;
      const tickerDetails: Record<string, { totalValue: number, shares: number, price: number, totalInvested: number }> = {};

      tickers.forEach(ticker => {
        const tickerDCAs = catDCAs.filter(r => (r.ticker || '') === ticker);
        const tickerTrades = catTrades.filter(r => (r.ticker || '') === ticker);

        const dcaShares = tickerDCAs.reduce((acc, r) => acc + r.shares, 0);
        const dcaInvested = tickerDCAs.reduce((acc, r) => acc + r.amount, 0);
        
        let tradeShares = 0;
        let tradeInvested = 0;
        tickerTrades.forEach(t => {
          if (t.type === 'buy') {
            tradeShares += t.shares;
            tradeInvested += t.totalAmount;
          } else {
            tradeShares -= t.shares;
            tradeInvested -= t.totalAmount;
          }
        });

        const totalShares = dcaShares + tradeShares;
        const totalInvestedForTicker = dcaInvested + tradeInvested;

        let price = 0;
        const manualPriceKey = ticker ? `${cat} - ${ticker}` : cat;
        if (manualPrices[manualPriceKey] !== undefined) {
          price = manualPrices[manualPriceKey];
        } else if (manualPrices[cat] !== undefined) {
          price = manualPrices[cat];
        } else {
          const sorted = [...tickerDCAs].sort((a, b) => {
            if (a.year !== b.year) return b.year - a.year;
            return b.month - a.month;
          });
          price = sorted.length > 0 ? sorted[0].price : 0;
        }

        const totalValue = totalShares * price;
        categoryTotalValue += totalValue;
        categoryTotalShares += totalShares;
        categoryTotalInvested += totalInvestedForTicker;

        tickerDetails[ticker] = { totalValue, shares: totalShares, price, totalInvested: totalInvestedForTicker };
      });

      categoryBreakdown[cat] = { totalValue: categoryTotalValue, shares: categoryTotalShares, price: 0, totalInvested: categoryTotalInvested, tickerDetails };
      estimatedAssetValue += categoryTotalValue;
    });

    const totalInvestedWithInitial = totalInvested + (state.initialCashReserve || 0);
    const growth = totalInvestedWithInitial > 0 ? ((estimatedAssetValue - totalInvestedWithInitial) / totalInvestedWithInitial) * 100 : 0;

    return {
      totalInvested,
      estimatedAssetValue,
      growth,
      categoryBreakdown
    };
  };

  const handleMonthClick = (date: Date) => {
    setSelectedMonth(date);
    const actual = state.actuals.find((a) => a.id === format(date, "yyyy-MM"));
    const projection = getProjectionForMonth(date);
    const { totalDCAAmount, dcaByCategory } = getDCASummary(date);

    if (actual) {
      setActualTotal(actual.actualTotal || 0);
      
      let newAllocations = [...(actual.actualAllocations || [])];
      
      if (Object.keys(dcaByCategory).length > 0) {
        Object.entries(dcaByCategory).forEach(([cat, data]: [string, any]) => {
          const categoryIndex = newAllocations.findIndex(a => a.category === cat);
          if (categoryIndex >= 0) {
            newAllocations[categoryIndex].amount = data.amount;
            if (newAllocations[categoryIndex].price === undefined) {
              newAllocations[categoryIndex].price = data.price;
            }
          } else {
            newAllocations.push({ category: cat, amount: data.amount, price: data.price });
          }
        });
      } else if (totalDCAAmount > 0) {
        const categoryIndex = newAllocations.findIndex(a => a.category.includes("股票") || a.category.includes("Stock") || a.category.includes("投資") || a.category.includes("Investment"));
        if (categoryIndex >= 0) {
           newAllocations[categoryIndex].amount = totalDCAAmount;
        } else if (newAllocations.length > 0) {
           newAllocations[0].amount = totalDCAAmount;
        }
      }
      setActualAllocations(newAllocations);

    } else if (projection && plan) {
      setActualTotal(projection.expectedTotal || 0);
      
      const suggestedAllocations = (plan.allocations || []).map((a) => ({
          category: a.category,
          amount: getAmountForDate(a, date),
      }));

      if (Object.keys(dcaByCategory).length > 0) {
        Object.entries(dcaByCategory).forEach(([cat, data]: [string, any]) => {
          const categoryIndex = suggestedAllocations.findIndex(a => a.category === cat);
          if (categoryIndex >= 0) {
            suggestedAllocations[categoryIndex].amount = data.amount;
            (suggestedAllocations[categoryIndex] as any).price = data.price;
          } else {
            suggestedAllocations.push({ category: cat, amount: data.amount, price: data.price } as any);
          }
        });
      } else if (totalDCAAmount > 0) {
         const categoryIndex = suggestedAllocations.findIndex(a => a.category.includes("股票") || a.category.includes("Stock") || a.category.includes("投資") || a.category.includes("Investment"));
         if (categoryIndex >= 0) {
            suggestedAllocations[categoryIndex].amount = totalDCAAmount;
         } else if (suggestedAllocations.length > 0) {
            suggestedAllocations[0].amount = totalDCAAmount;
         }
      }

      setActualAllocations(suggestedAllocations);
    } else {
      setActualTotal(0);
      setActualAllocations([]);
    }
  };

  const handleSaveActual = () => {
    if (!selectedMonth) return;
    const id = format(selectedMonth, "yyyy-MM");
    const calculatedTotal = getCumulativeStats(selectedMonth).estimatedAssetValue;
    addOrUpdateActual({
      id,
      actualTotal: calculatedTotal,
      actualAllocations,
    });
    setSelectedMonth(null);
  };

  if (!plan) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <div className="bg-gray-100 p-6 rounded-full mb-6">
          <Target className="w-16 h-16 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          尚未建立財富增值方案
        </h2>
        <p className="text-gray-500">
          請先前往「AI 財富增值方案」頁面生成您的專屬計劃。
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto space-y-8 pb-24"
    >
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 to-teal-700 p-8 rounded-3xl shadow-xl border border-emerald-500/30 text-white mb-8 group">
        <div className="absolute top-0 right-0 -mt-16 -mr-16 w-80 h-80 bg-white opacity-10 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-1000"></div>
        <div className="absolute bottom-0 left-0 -mb-16 -ml-16 w-64 h-64 bg-emerald-300 opacity-20 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-1000"></div>

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-center gap-6">
            <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-md border border-white/20 shadow-inner">
              <CalendarIcon className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2 drop-shadow-sm">
                資產追蹤月曆
              </h1>
              <p className="text-emerald-100 text-lg font-medium">
                追蹤每月目標，確保財富穩步增長
              </p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-md border border-white/20 shadow-inner text-right min-w-[180px]">
              <p className="text-emerald-100 text-sm font-bold uppercase tracking-wider mb-1">現時總收益</p>
              <p className={`font-extrabold text-white drop-shadow-md ${typeof currentTotalAsset === 'string' ? 'text-xl' : 'text-3xl'}`}>
                {typeof currentTotalAsset === 'string' ? currentTotalAsset : `$${currentTotalAsset.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              </p>
            </div>

            <div className="flex items-center gap-4 bg-white/10 p-2 rounded-2xl backdrop-blur-md border border-white/20 shadow-inner">
              <button
                onClick={() => setCurrentDate(subMonths(currentDate, 12))}
                className="p-2 hover:bg-white/20 rounded-xl transition-colors text-white"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            <span className="text-xl font-bold text-white min-w-[100px] text-center drop-shadow-sm">
              {format(currentDate, "yyyy")} 年
            </span>
            <button
              onClick={() => setCurrentDate(addMonths(currentDate, 12))}
              className="p-2 hover:bg-white/20 rounded-xl transition-colors text-white"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-xl border border-white/50">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {months.map((month) => {
            const projection = getProjectionForMonth(month);
            const actual = state.actuals.find(
              (a) => a.id === format(month, "yyyy-MM"),
            );
            const isCurrent = isSameMonth(month, new Date());

            let statusColor = "bg-white border-gray-100 hover:border-emerald-200 hover:shadow-md";
            let statusIcon = null;

            if (actual && projection) {
              if (actual.actualTotal >= projection.expectedTotal) {
                statusColor = "bg-emerald-50/50 border-emerald-200 hover:bg-emerald-50 hover:shadow-md";
                statusIcon = (
                  <div className="absolute top-3 right-3 bg-emerald-100 p-1 rounded-full">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                  </div>
                );
              } else {
                statusColor = "bg-rose-50/50 border-rose-200 hover:bg-rose-50 hover:shadow-md";
                statusIcon = (
                  <div className="absolute top-3 right-3 bg-rose-100 p-1 rounded-full">
                    <XCircle className="w-4 h-4 text-rose-600" />
                  </div>
                );
              }
            } else if (projection) {
              statusColor =
                "bg-white border-gray-100 hover:border-emerald-300 hover:shadow-lg cursor-pointer group";
            }

            return (
              <motion.div
                key={month.toISOString()}
                whileHover={projection ? { scale: 1.02, y: -2 } : {}}
                onClick={() => projection && handleMonthClick(month)}
                className={`relative p-6 rounded-2xl border transition-all duration-300 ${statusColor} ${!projection ? "opacity-40 grayscale cursor-not-allowed bg-gray-50" : ""} ${isCurrent ? "ring-2 ring-emerald-500 ring-offset-2 shadow-emerald-100" : ""}`}
              >
                {statusIcon}
                <h3 className="text-xl font-extrabold text-gray-900 mb-2 font-mono">
                  {format(month, "M")}月
                </h3>

                {projection ? (
                  <div className="space-y-3 mt-4">
                    <div>
                      <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">
                        目標資產
                      </p>
                      <p className="text-lg font-extrabold text-emerald-700 tracking-tight">
                        ${(projection.expectedTotal / 10000).toFixed(1)}萬
                      </p>
                    </div>
                    {actual && (
                      <div className="pt-3 border-t border-gray-100">
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">
                          實際資產
                        </p>
                        <p
                          className={`text-lg font-extrabold tracking-tight ${actual.actualTotal >= projection.expectedTotal ? "text-emerald-600" : "text-rose-600"}`}
                        >
                          ${(actual.actualTotal / 10000).toFixed(1)}萬
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 mt-4 font-medium">無計劃數據</p>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Modal for Month Details */}
      <AnimatePresence>
        {selectedMonth && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar border border-gray-100"
            >
              <div className="sticky top-0 bg-gradient-to-r from-emerald-600 to-teal-600 p-6 text-white flex justify-between items-center z-10 shadow-md">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Sparkles className="w-6 h-6" />
                  {selectedMonth ? format(selectedMonth, "yyyy年 M月") : ""} 資產更新
                </h2>
                <button
                  onClick={() => setSelectedMonth(null)}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors text-white"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <div className="p-8 space-y-8">
                {/* Portfolio Snapshot */}
                {(() => {
                  const { totalInvested, estimatedAssetValue, growth } = getCumulativeStats(selectedMonth!);
                  return (
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-2xl border border-blue-100 shadow-sm">
                      <h3 className="text-lg font-bold text-blue-800 mb-4 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5" /> 投資組合概覽 (Portfolio Snapshot)
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                          <p className="text-xs text-blue-600 font-bold uppercase tracking-wider mb-1">截至本月總投入資金</p>
                          <p className="text-2xl font-extrabold text-gray-900">${totalInvested.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-blue-600 font-bold uppercase tracking-wider mb-1">實際資產總值 (自動計算)</p>
                          <p className="text-2xl font-extrabold text-emerald-600">${estimatedAssetValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                        </div>
                        <div>
                          <p className="text-xs text-blue-600 font-bold uppercase tracking-wider mb-1">資產升幅</p>
                          <div className={`flex items-center gap-1 text-2xl font-extrabold ${growth >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {growth >= 0 ? '+' : ''}{growth.toFixed(2)}%
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Target vs Actual Total */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-emerald-50/50 p-6 rounded-2xl border border-emerald-100 shadow-sm">
                    <p className="text-sm text-emerald-600 font-bold mb-2 flex items-center gap-2 uppercase tracking-wider">
                      <Target className="w-4 h-4" /> 理想目標總額
                    </p>
                    <p className="text-3xl font-extrabold text-emerald-800 tracking-tight">
                      $
                      {getProjectionForMonth(
                        selectedMonth,
                      )?.expectedTotal?.toLocaleString() || "0"}
                    </p>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                    <p className="text-sm text-gray-500 font-bold mb-2 flex items-center gap-2 uppercase tracking-wider">
                      <TrendingUp className="w-4 h-4" /> 實際總額 (自動計算)
                    </p>
                    <div className="relative mt-2">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 font-bold text-xl">
                        $
                      </span>
                      <input
                        type="text"
                        value={getCumulativeStats(selectedMonth!).estimatedAssetValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        readOnly
                        className="pl-8 bg-transparent border-none text-gray-900 text-3xl font-extrabold block w-full p-0 focus:ring-0 cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>

                {/* Allocations */}
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <div className="w-1 h-6 bg-emerald-500 rounded-full"></div>
                    資產分佈 (Asset Distribution)
                  </h3>
                  <div className="space-y-4">
                    {(plan.allocations || []).map((alloc, idx) => {
                      const actualAlloc = (actualAllocations || []).find(
                        (a) => a.category === alloc.category,
                      );
                      const projection = getProjectionForMonth(selectedMonth);
                      const expectedTotal = projection?.categoryTotals?.[alloc.category] || 0;
                      
                      const stats = getCumulativeStats(selectedMonth!);
                      const catStats = stats.categoryBreakdown[alloc.category] || { totalValue: 0, shares: 0, price: 0, totalInvested: 0, tickerDetails: {} };
                      const actualTotalValue = catStats.totalValue;
                      const gap = actualTotalValue - expectedTotal;

                      return (
                        <div
                          key={idx}
                          className="flex flex-col gap-4 bg-gray-50/50 p-5 rounded-2xl border border-gray-100 hover:bg-white hover:shadow-md transition-all group"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-bold text-gray-900 text-lg mb-1">
                                {alloc.category}
                              </p>
                              <div className="flex flex-wrap gap-2 mt-2">
                                <div className="bg-gray-100 px-3 py-2 rounded-lg border border-gray-200">
                                  <p className="text-xs text-gray-500 font-bold mb-1">
                                    {alloc.category === "現金儲備／定期" || alloc.category === "流動資金及定期存款" ? "該月建議投入資金" : "該月建議定投額"}
                                  </p>
                                  <p className="text-sm font-bold text-gray-900">${getAmountForDate(alloc, selectedMonth!).toLocaleString() || "0"}</p>
                                </div>
                                <div className="bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-100">
                                  <p className="text-xs text-emerald-600 font-bold mb-1">
                                    {alloc.category === "現金儲備／定期" || alloc.category === "流動資金及定期存款" ? "該月理想剩餘資金" : "該月理想該項投資工具總值"}
                                  </p>
                                  <p className="text-sm font-bold text-emerald-700">${Math.round(expectedTotal).toLocaleString()}</p>
                                </div>
                                <div className="bg-blue-50 px-3 py-2 rounded-lg border border-blue-100">
                                  <p className="text-xs text-blue-600 font-bold mb-1">
                                    {alloc.category === "現金儲備／定期" || alloc.category === "流動資金及定期存款" ? "實際投入資金" : "實際定投額"}
                                  </p>
                                  <p className="text-sm font-bold text-blue-700">${actualAlloc?.amount?.toLocaleString() || "0"}</p>
                                </div>
                                <div className="bg-indigo-50 px-3 py-2 rounded-lg border border-indigo-100">
                                  <p className="text-xs text-indigo-600 font-bold mb-1">
                                    {alloc.category === "現金儲備／定期" || alloc.category === "流動資金及定期存款" ? "實際剩餘現金儲備" : "實際投資工具總值"}
                                  </p>
                                  <p className="text-sm font-bold text-indigo-700">${Math.round(actualTotalValue).toLocaleString()}</p>
                                </div>
                                {alloc.category !== "現金儲備／定期" && alloc.category !== "流動資金及定期存款" && (
                                  <>
                                    <div className="bg-purple-50 px-3 py-2 rounded-lg border border-purple-100">
                                      <p className="text-xs text-purple-600 font-bold mb-1">總投入資產</p>
                                      <p className="text-sm font-bold text-purple-700">${Math.round(catStats.totalInvested || 0).toLocaleString()}</p>
                                    </div>
                                    <div className={`px-3 py-2 rounded-lg border ${(actualTotalValue - (catStats.totalInvested || 0)) >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                                      <p className={`text-xs font-bold mb-1 ${(actualTotalValue - (catStats.totalInvested || 0)) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>回報（＋／－）</p>
                                      <p className={`text-sm font-bold ${(actualTotalValue - (catStats.totalInvested || 0)) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                        {(actualTotalValue - (catStats.totalInvested || 0)) >= 0 ? '+' : ''}{Math.round(actualTotalValue - (catStats.totalInvested || 0)).toLocaleString()}
                                      </p>
                                    </div>
                                  </>
                                )}
                                <div className={`px-3 py-2 rounded-lg border ${gap >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                                  <p className={`text-xs font-bold mb-1 ${gap >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>目標與現實差距（＋／－）</p>
                                  <p className={`text-sm font-bold ${gap >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                    {gap >= 0 ? '+' : ''}{Math.round(gap).toLocaleString()}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {alloc.category !== "現金儲備／定期" && alloc.category !== "流動資金及定期存款" && (
                            <div className="mt-4">
                              {(() => {
                                const allTickers = Array.from(new Set([
                                  ...(alloc.tickers || []),
                                  ...Object.keys(catStats.tickerDetails || {})
                                ])).filter(Boolean);

                                if (allTickers.length > 0) {
                                  return (
                                    <div className="space-y-3">
                                      {allTickers.map((ticker) => {
                                        const details = catStats.tickerDetails?.[ticker] || { totalValue: 0, shares: 0, price: 0, totalInvested: 0 };
                                        const manualPriceKey = `${alloc.category} - ${ticker}`;
                                        const tickerActualAlloc = actualAllocations?.find(a => a.category === manualPriceKey);
                                        
                                        return (
                                          <div key={ticker} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                                            <div className="flex justify-between items-center mb-3">
                                              <span className="font-bold text-gray-900">{ticker}</span>
                                              <div className="flex gap-4 text-right">
                                                <div>
                                                  <p className="text-xs text-gray-500 font-bold mb-1">該月建議定投額</p>
                                                  <p className="text-sm font-bold text-gray-900">${Math.round(getAmountForDate(alloc, selectedMonth!) * ((alloc.tickerPercentages?.[ticker] !== undefined ? alloc.tickerPercentages[ticker] : (100 / allTickers.length)) / 100)).toLocaleString()}</p>
                                                </div>
                                                <div>
                                                  <p className="text-xs text-gray-500 font-bold mb-1">實際定投額</p>
                                                  <p className="text-sm font-bold text-blue-700">${tickerActualAlloc?.amount?.toLocaleString() || "0"}</p>
                                                </div>
                                                <div>
                                                  <p className="text-xs text-gray-500 font-bold mb-1">總投入資產</p>
                                                  <p className="text-sm font-bold text-purple-700">${Math.round(details.totalInvested || 0).toLocaleString()}</p>
                                                </div>
                                                <div>
                                                  <p className="text-xs text-gray-500 font-bold mb-1">實際投資工具總值</p>
                                                  <p className="text-sm font-bold text-indigo-700">${Math.round(details.totalValue).toLocaleString()}</p>
                                                </div>
                                                <div>
                                                  <p className="text-xs text-gray-500 font-bold mb-1">回報（＋／－）</p>
                                                  <p className={`text-sm font-bold ${(details.totalValue - (details.totalInvested || 0)) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                                    {(details.totalValue - (details.totalInvested || 0)) >= 0 ? '+' : ''}{Math.round(details.totalValue - (details.totalInvested || 0)).toLocaleString()}
                                                  </p>
                                                </div>
                                              </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                              <div className="flex-1">
                                                <label className="block text-xs font-bold text-gray-500 mb-1">股票現價</label>
                                                <div className="relative">
                                                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 font-bold">$</span>
                                                  <input
                                                    type="number"
                                                    value={tickerActualAlloc?.price || ""}
                                                    onChange={(e) => {
                                                      const newAllocs = [...(actualAllocations || [])];
                                                      const existingIdx = newAllocs.findIndex(
                                                        (a) => a.category === manualPriceKey,
                                                      );
                                                      if (existingIdx >= 0) {
                                                        newAllocs[existingIdx].price = Number(e.target.value);
                                                      } else {
                                                        newAllocs.push({
                                                          category: manualPriceKey,
                                                          amount: 0,
                                                          price: Number(e.target.value)
                                                        });
                                                      }
                                                      setActualAllocations(newAllocs);
                                                    }}
                                                    className="pl-7 bg-gray-50 border border-gray-200 text-gray-900 text-sm font-bold rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 block w-full p-2 transition-all"
                                                    placeholder={details.price.toString()}
                                                  />
                                                </div>
                                              </div>
                                              <div className="flex-1 text-right">
                                                <p className="text-xs text-gray-500 font-bold mb-1">持有股數</p>
                                                <p className="text-sm font-bold text-gray-900">{details.shares.toFixed(4)}</p>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                }

                                return (
                                  <div className="mt-2">
                                    <label className="block text-xs font-bold text-gray-500 mb-1">股票現價 (用作計算實際總值)</label>
                                    <div className="relative max-w-xs">
                                      <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-gray-400 font-bold">
                                        $
                                      </span>
                                      <input
                                        type="number"
                                        value={actualAlloc?.price || ""}
                                        onChange={(e) => {
                                          const newAllocs = [...(actualAllocations || [])];
                                          const existingIdx = newAllocs.findIndex(
                                            (a) => a.category === alloc.category,
                                          );
                                          if (existingIdx >= 0) {
                                            newAllocs[existingIdx].price = Number(
                                              e.target.value,
                                            );
                                          } else {
                                            newAllocs.push({
                                              category: alloc.category,
                                              amount: 0,
                                              price: Number(e.target.value)
                                            });
                                          }
                                          setActualAllocations(newAllocs);
                                        }}
                                        className="pl-8 bg-white border border-gray-200 text-gray-900 text-sm font-bold rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 block w-full p-3 transition-all group-hover:border-emerald-200"
                                        placeholder="現時價格"
                                      />
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Monthly Records */}
                {(() => {
                  const { monthlyDCARecords, monthlyTradeRecords } = getDCASummary(selectedMonth!);
                  if (monthlyDCARecords.length === 0 && monthlyTradeRecords.length === 0) return null;
                  
                  return (
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <div className="w-1 h-6 bg-indigo-500 rounded-full"></div>
                        本月定投及交易記錄
                      </h3>
                      <div className="space-y-3">
                        {monthlyDCARecords.map(r => (
                          <div key={r.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex justify-between items-center">
                            <div>
                              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md mb-1 inline-block">定投 (DCA)</span>
                              <p className="font-bold text-gray-900">{r.ticker}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-gray-900">-${r.amount.toLocaleString()}</p>
                              <p className="text-xs text-gray-500">@ ${r.price} / {r.shares.toFixed(2)}股</p>
                            </div>
                          </div>
                        ))}
                        {monthlyTradeRecords.map(r => (
                          <div key={r.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex justify-between items-center">
                            <div>
                              <span className={`text-xs font-bold px-2 py-1 rounded-md mb-1 inline-block ${r.type === 'buy' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                {r.type === 'buy' ? '買入 (Buy)' : '賣出 (Sell)'}
                              </span>
                              <p className="font-bold text-gray-900">{r.ticker}</p>
                            </div>
                            <div className="text-right">
                              <p className={`font-bold ${r.type === 'buy' ? 'text-gray-900' : 'text-emerald-600'}`}>
                                {r.type === 'buy' ? '-' : '+'}${r.totalAmount.toLocaleString()}
                              </p>
                              <p className="text-xs text-gray-500">@ ${r.price} / {r.shares}股</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* AI Advice based on difference */}
                {(() => {
                  const calculatedTotal = getCumulativeStats(selectedMonth!).estimatedAssetValue;
                  const projection = getProjectionForMonth(selectedMonth!);
                  if (calculatedTotal > 0 && selectedMonth && projection) {
                    const expectedTotal = projection.expectedTotal || 0;
                    return (
                      <div
                        className={`p-6 rounded-2xl border ${calculatedTotal >= expectedTotal ? "bg-emerald-50/50 border-emerald-200 text-emerald-800" : "bg-amber-50/50 border-amber-200 text-amber-800"}`}
                      >
                        <h4 className="font-bold mb-3 flex items-center gap-2 text-lg">
                          <Sparkles className="w-5 h-5" /> 系統分析與調整建議
                        </h4>
                        <p className="text-base leading-relaxed font-medium opacity-90">
                          {calculatedTotal >= expectedTotal
                            ? "太棒了！您的實際資產已達到或超越預期目標。請繼續保持目前的投資策略，財富自由指日可待。"
                            : (() => {
                                const shortfall = expectedTotal - calculatedTotal;
                                const remainingMonths = (plan.years || 0) * 12 - (projection.monthIndex || 0);
                                if (remainingMonths > 0) {
                                  const extraPerMonth = Math.ceil(shortfall / remainingMonths);
                                  return `目前的實際資產比預期落後 $${shortfall.toLocaleString(undefined, { maximumFractionDigits: 0 })}。為了在剩餘的 ${remainingMonths} 個月內達到最終目標，系統建議您在未來的每個月額外增加 $${extraPerMonth.toLocaleString()} 的儲蓄或投資投入。`;
                                }
                                return `目前的實際資產比預期落後 $${shortfall.toLocaleString(undefined, { maximumFractionDigits: 0 })}。這是計劃的最後一個月，請檢視整體投資組合的表現。`;
                              })()}
                        </p>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              <div className="sticky bottom-0 bg-white p-6 border-t border-gray-100 flex gap-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <button
                  onClick={() => setSelectedMonth(null)}
                  className="flex-1 py-4 px-6 bg-gray-50 hover:bg-gray-100 text-gray-600 font-bold rounded-2xl transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveActual}
                  className="flex-1 py-4 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 hover:shadow-xl hover:-translate-y-0.5"
                >
                  <Save className="w-5 h-5" /> 更新記錄
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
