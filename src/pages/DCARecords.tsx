import React, { useState, useMemo, useRef, useEffect } from "react";
import { useAppContext, DCARecord, TradeRecord } from "../store";
import { motion, AnimatePresence } from "motion/react";
import { toJpeg } from "html-to-image";
import CandlestickChart from "../components/CandlestickChart";
import { jsPDF } from "jspdf";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// Custom Dot for the chart
const CustomDot = (props: any) => {
  const { cx, cy, index, dataLength } = props;
  
  let fill = "#3b82f6"; // Blue (Pure DCA)
  
  if (index === 0) {
    fill = "#06b6d4"; // Blue-Green (Entry)
  } else if (index === dataLength - 1) {
    fill = "#db2777"; // Blue-Red (Exit)
  }

  return (
    <circle cx={cx} cy={cy} r={5} stroke="white" strokeWidth={2} fill={fill} />
  );
};

import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  Save,
  AlertCircle,
  ArrowRightLeft,
  Wallet,
  PieChart,
  History,
  Target,
  ChevronDown,
  FileText,
  Download,
  Upload,
  X,
  Image as ImageIcon,
  RefreshCw,
} from "lucide-react";

import { OverallReportModal } from "../components/OverallReportModal";

export default function DCARecords() {
  const { state, addOrUpdateDCARecord, deleteDCARecord, addTradeRecord, deleteTradeRecord, importDCADataset, setInitialCashReserve } = useAppContext();
  const [showOverallReport, setShowOverallReport] = useState(false);
  
  // --- Categories from AI Plan ---
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

  const [selectedCategory, setSelectedCategory] = useState<string>(categories[0]);

  useEffect(() => {
    if (!categories.includes(selectedCategory)) {
      setSelectedCategory(categories[0]);
    }
  }, [categories, selectedCategory]);

  // --- State for DCA Input ---
  const [tabInputs, setTabInputs] = useState<Record<string, {
    ticker: string;
    monthlyAmount: number;
    currentPrice: number;
    dividendPerShare: number;
    annualInterestRate: number;
    exchangeRate: number;
    minLotSize: number;
  }>>({});

  const [noDCAModes, setNoDCAModes] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (state.aiPlan && state.aiPlan.allocations.length > 0) {
      const newNoDCA: Record<string, boolean> = {};
      categories.forEach(cat => {
        const baseCategory = cat.includes(" - ") ? cat.split(" - ")[0] : cat;
        const ticker = cat.includes(" - ") ? cat.split(" - ")[1] : "";
        const allocation = state.aiPlan?.allocations.find(a => a.category === baseCategory);
        
        if (allocation) {
          let isZero = allocation.percentage === 0;
          if (!isZero && ticker && allocation.tickerPercentages && allocation.tickerPercentages[ticker] !== undefined) {
            isZero = allocation.tickerPercentages[ticker] === 0;
          }
          newNoDCA[cat] = isZero;
        }
      });
      setNoDCAModes(prev => ({ ...prev, ...newNoDCA }));
    }
  }, [state.aiPlan, categories]);

  const toggleNoDCA = (category: string) => {
    setNoDCAModes(prev => ({ ...prev, [category]: !prev[category] }));
  };

  const currentTabInput = tabInputs[selectedCategory] || {
    ticker: selectedCategory.includes(" - ") ? selectedCategory.split(" - ")[1] : "",
    monthlyAmount: 0,
    currentPrice: 0,
    dividendPerShare: 0,
    annualInterestRate: 0,
    exchangeRate: 1,
    minLotSize: 1,
  };

  const ticker = currentTabInput.ticker;
  const isUSStock = ticker && /^[A-Za-z]/.test(ticker);
  const monthlyAmount = currentTabInput.monthlyAmount;
  const currentPrice = currentTabInput.currentPrice;
  const dividendPerShare = currentTabInput.dividendPerShare;
  const annualInterestRate = currentTabInput.annualInterestRate;
  const exchangeRate = currentTabInput.exchangeRate || (isUSStock ? 7.8 : 1);
  const minLotSize = currentTabInput.minLotSize || 1;

  const updateTabInput = (key: string, value: any) => {
    setTabInputs(prev => ({
      ...prev,
      [selectedCategory]: {
        ...(prev[selectedCategory] || {
          ticker: selectedCategory.includes(" - ") ? selectedCategory.split(" - ")[1] : "",
          monthlyAmount: 0,
          currentPrice: 0,
          dividendPerShare: 0,
          annualInterestRate: 0,
          exchangeRate: isUSStock ? 7.8 : 1,
          minLotSize: 1,
        }),
        [key]: value
      }
    }));
  };

  const [selectedYear, setSelectedYear] = useState(state.aiPlan ? state.aiPlan.startYear : new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(state.aiPlan ? state.aiPlan.startMonth : new Date().getMonth() + 1);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("每一個月");

  // Sync selected date to the global frontier (earliest incomplete month)
  useEffect(() => {
    if (!state.aiPlan) return;
    let currentYear = state.aiPlan.startYear;
    let currentMonth = state.aiPlan.startMonth;
    const maxYear = currentYear + state.aiPlan.years;

    let foundIncomplete = false;
    while (currentYear <= maxYear) {
      const allCategoriesComplete = categories.every(cat => {
        return state.dcaRecords.some(r => r.year === currentYear && r.month === currentMonth && (r.category === cat || (!r.category && cat === "一般定投")));
      });
      if (!allCategoriesComplete) {
        foundIncomplete = true;
        break;
      }
      currentMonth++;
      if (currentMonth > 12) {
        currentMonth = 1;
        currentYear++;
      }
    }
    if (foundIncomplete) {
      setSelectedYear(currentYear);
      setSelectedMonth(currentMonth);
    }
  }, [categories, state.aiPlan, state.dcaRecords.length]); // Run when records change to advance globally

  // Auto-fill recommended amount when category or date changes
  useEffect(() => {
    if (state.aiPlan) {
      const baseCategory = selectedCategory.includes(" - ") ? selectedCategory.split(" - ")[0] : selectedCategory;
      const allocation = state.aiPlan.allocations.find(a => a.category === baseCategory);
      if (allocation) {
        const period = allocation.periods.find(p => {
          const pStart = p.startYear * 12 + p.startMonth;
          const pEnd = p.endYear * 12 + p.endMonth;
          const current = selectedYear * 12 + selectedMonth;
          return current >= pStart && current <= pEnd;
        });
        
        let recommendedAmount = period ? period.amount : 0;
        
        // If there are multiple tickers, use the ticker percentage
        if (allocation.tickers && allocation.tickers.length > 0) {
          const ticker = selectedCategory.includes(" - ") ? selectedCategory.split(" - ")[1] : "";
          if (ticker && allocation.tickerPercentages && allocation.tickerPercentages[ticker] !== undefined) {
            recommendedAmount = Math.round(recommendedAmount * (allocation.tickerPercentages[ticker] / 100));
          } else {
            recommendedAmount = Math.round(recommendedAmount / allocation.tickers.length);
          }
        }
        
        setTabInputs(prev => {
          const current = prev[selectedCategory];
          // Only auto-fill if it's currently 0 or undefined
          if (!current || !current.monthlyAmount) {
            return {
              ...prev,
              [selectedCategory]: {
                ...(current || { ticker: selectedCategory.includes(" - ") ? selectedCategory.split(" - ")[1] : "", currentPrice: 0, dividendPerShare: 0, annualInterestRate: 0 }),
                monthlyAmount: recommendedAmount
              }
            };
          }
          return prev;
        });
      }
    }
  }, [selectedCategory, selectedYear, selectedMonth, state.aiPlan]);

  // --- State for Asset Overview ---
  const [realTimePrices, setRealTimePrices] = useState<Record<string, number>>({});
  
  useEffect(() => {
    setRealTimePrices(prev => {
      let updated = false;
      const newPrices = { ...prev };
      categories.forEach(cat => {
        if (newPrices[cat] === undefined) {
          const catBase = cat.includes(" - ") ? cat.split(" - ")[0] : cat;
          const catTicker = cat.includes(" - ") ? cat.split(" - ")[1] : "";
          const records = state.dcaRecords.filter(r => (r.category === catBase && (catTicker ? r.ticker === catTicker : true)) || (!r.category && catBase === "一般定投"));
          if (records.length > 0) {
            newPrices[cat] = records[records.length - 1].price;
            updated = true;
          }
        }
      });
      return updated ? newPrices : prev;
    });
  }, [categories, state.dcaRecords]);

  const realTimePrice = realTimePrices[selectedCategory] || 0;
  const setRealTimePrice = (val: number) => setRealTimePrices(prev => ({ ...prev, [selectedCategory]: val }));

  // --- State for Trading Interface ---
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [tradePrice, setTradePrice] = useState<number>(0);
  const [tradeShares, setTradeShares] = useState<number>(0);
  const [tradeYear, setTradeYear] = useState(selectedYear);
  const [tradeMonth, setTradeMonth] = useState(selectedMonth);

  useEffect(() => {
    setTradeYear(selectedYear);
    setTradeMonth(selectedMonth);
  }, [selectedYear, selectedMonth]);

  // --- State for Report Modal ---
  const [showReport, setShowReport] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showReport) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showReport]);

  // --- Calculations ---
  const baseSelectedCategory = selectedCategory.includes(" - ") ? selectedCategory.split(" - ")[0] : selectedCategory;
  const selectedTicker = useMemo(() => {
    console.log(`Deriving ticker for category: "${selectedCategory}"`);
    
    // First check if user has manually entered a ticker in the input field
    const manualTicker = tabInputs[selectedCategory]?.ticker?.trim();
    if (manualTicker) {
      console.log(`Using manual ticker: "${manualTicker}"`);
      return manualTicker;
    }

    if (selectedCategory.includes(" - ")) {
      const parts = selectedCategory.split(" - ");
      const ticker = parts[parts.length - 1].trim();
      console.log(`Found ticker via separator: "${ticker}"`);
      return ticker;
    }
    // Fallback: check if the category itself looks like a ticker (e.g. AAPL, 0700.HK, 2330.TW)
    const trimmed = selectedCategory.trim();
    if (/^[A-Z0-9.]+$/.test(trimmed) && trimmed.length >= 1) {
      console.log(`Category itself is a ticker: "${trimmed}"`);
      return trimmed;
    }
    console.log(`No ticker found for category: "${selectedCategory}"`);
    return "";
  }, [selectedCategory, tabInputs]);
  const isLiquidity = baseSelectedCategory === "流動資金及定期存款" || baseSelectedCategory === "現金儲備／定期";

  // Filter records by selected category for stats and reports
  const categoryDCARecords = useMemo(() => {
    return state.dcaRecords.filter(r => (r.category === baseSelectedCategory && (selectedTicker ? r.ticker === selectedTicker : true)) || (!r.category && baseSelectedCategory === "一般定投"));
  }, [state.dcaRecords, baseSelectedCategory, selectedTicker]);

  const categoryTradeRecords = useMemo(() => {
    return state.tradeRecords.filter(r => (r.category === baseSelectedCategory && (selectedTicker ? r.ticker === selectedTicker : true)) || (!r.category && baseSelectedCategory === "一般定投"));
  }, [state.tradeRecords, baseSelectedCategory, selectedTicker]);

  const tradeStats = useMemo(() => {
    let cashReserve = state.initialCashReserve;
    let liquidityValue = 0;
    let liquidityInvested = 0;
    
    // Add remainders from ALL DCA records (cash is global)
    state.dcaRecords.forEach(r => {
      const isRecordLiquidity = r.category === "現金儲備／定期" || r.category === "流動資金及定期存款" || (!r.category && (selectedCategory === "現金儲備／定期" || selectedCategory === "流動資金及定期存款"));
      if (isRecordLiquidity) {
        liquidityValue += r.amount;
        liquidityInvested += r.amount;
        if (r.dividendPerShare) {
          liquidityValue += r.dividendPerShare;
        }
      }
      if (r.remainder) {
        cashReserve += r.remainder;
      }
    });

    // Calculate total dividends from DCA records across all categories
    // To do this accurately, we need to interleave DCA and Trade records for each category
    const categories = Array.from(new Set([...state.dcaRecords.map(r => r.category || "一般定投"), ...state.tradeRecords.map(r => r.category || "一般定投")]));
    
    categories.forEach(cat => {
      const isCatLiquidity = cat === "現金儲備／定期" || cat === "流動資金及定期存款";
      if (isCatLiquidity) return;

      const catDCA = state.dcaRecords.filter(r => (r.category || "一般定投") === cat);
      const catTrades = state.tradeRecords.filter(r => (r.category || "一般定投") === cat);
      
      const timeline: any[] = [];
      catDCA.forEach(r => {
        const date = new Date(r.year, r.month - 1, r.period === "15號" ? 15 : 1);
        timeline.push({ date, type: 'DCA', shares: r.shares, dividendPerShare: r.dividendPerShare || 0, ticker: r.ticker });
      });
      catTrades.forEach(r => {
        timeline.push({ date: new Date(r.date), type: r.type, shares: r.shares, dividendPerShare: 0, ticker: r.ticker });
      });
      
      timeline.sort((a, b) => a.date.getTime() - b.date.getTime());
      
      let cumulativeShares = 0;
      timeline.forEach(item => {
        if (item.type === 'DCA' || item.type === 'buy') {
          cumulativeShares += item.shares;
          if (item.type === 'DCA' && item.dividendPerShare > 0) {
            const isUS = item.ticker && /^[A-Za-z]/.test(item.ticker);
            const rate = isUS ? 7.8 : 1;
            cashReserve += (cumulativeShares * item.dividendPerShare) * rate;
          }
        } else if (item.type === 'sell') {
          cumulativeShares -= item.shares;
        }
      });
    });

    let tradeShares = 0;

    // Cash is global, but shares are per category
    state.tradeRecords.forEach(trade => {
      if (trade.type === 'sell') {
        cashReserve += trade.totalAmount;
        if (trade.category === selectedCategory || (!trade.category && selectedCategory === "一般定投")) {
          tradeShares -= trade.shares;
        }
      } else if (trade.type === 'buy') {
        cashReserve -= trade.totalAmount;
        if (trade.category === selectedCategory || (!trade.category && selectedCategory === "一般定投")) {
          tradeShares += trade.shares;
        }
      } else if (trade.type === 'withdraw') {
        const isTradeLiquidity = trade.category === "現金儲備／定期" || trade.category === "流動資金及定期存款";
        if (isTradeLiquidity) {
          cashReserve += trade.totalAmount;
          liquidityValue -= trade.totalAmount;
          liquidityInvested -= trade.totalAmount;
        }
      } else if (trade.type === 'dividend') {
        cashReserve += trade.totalAmount;
      }
    });

    return { cashReserve, tradeShares, liquidityValue, liquidityInvested };
  }, [state.tradeRecords, state.initialCashReserve, state.dcaRecords, selectedCategory]);

  const dcaStats = useMemo(() => {
    if (isLiquidity) {
      return { 
        totalInvested: tradeStats.liquidityInvested, 
        totalShares: tradeStats.liquidityValue, 
        avgPrice: 1 
      };
    }

    let totalInvested = categoryDCARecords.reduce((acc, r) => acc + r.amount, 0);
    let totalShares = categoryDCARecords.reduce((acc, r) => acc + r.shares, 0);
    
    categoryTradeRecords.forEach(trade => {
      if (trade.type === 'buy') {
        totalInvested += trade.totalAmount;
        totalShares += trade.shares;
      } else if (trade.type === 'sell') {
        if (totalShares > 0) {
          const avgCost = totalInvested / totalShares;
          totalInvested -= avgCost * trade.shares;
        }
        totalShares -= trade.shares;
      }
    });

    const avgPriceInHKD = totalShares > 0 ? totalInvested / totalShares : 0;
    const avgPrice = avgPriceInHKD / (currentTabInput.exchangeRate || (ticker && /^[A-Za-z]/.test(ticker) ? 7.8 : 1));
    return { totalInvested, totalShares, avgPrice };
  }, [categoryDCARecords, categoryTradeRecords, isLiquidity, tradeStats.liquidityInvested, tradeStats.liquidityValue, exchangeRate, ticker]);

  const totalSharesHeld = isLiquidity ? tradeStats.liquidityValue : dcaStats.totalShares;
  const totalAssetValue = totalSharesHeld * realTimePrice * exchangeRate;
  const totalAccountValue = isLiquidity ? totalSharesHeld : totalAssetValue + tradeStats.cashReserve;
  
  const sharesAtTradeDate = useMemo(() => {
    if (isLiquidity) return 0;
    const date = new Date(tradeYear, tradeMonth - 1, 1);
    
    let shares = categoryDCARecords
      .filter(r => new Date(r.year, r.month - 1, 1) <= date)
      .reduce((acc, r) => acc + r.shares, 0);
      
    categoryTradeRecords
      .filter(t => new Date(t.date) <= date)
      .forEach(trade => {
        if (trade.type === 'buy') {
          shares += trade.shares;
        } else if (trade.type === 'sell') {
          shares -= trade.shares;
        }
      });
      
    return shares;
  }, [categoryDCARecords, categoryTradeRecords, tradeYear, tradeMonth, isLiquidity]);

  useEffect(() => {
    if (tradeType === 'dividend') {
      setTradeShares(sharesAtTradeDate);
    }
  }, [tradeType, sharesAtTradeDate]);
  
  const adviceLevels = [
    { label: "保守 (Conservative)", exitPct: 110, reEntryFactor: 0.9, color: "text-emerald-400", bg: "bg-gray-800/50", border: "border-gray-700", icon: "text-emerald-400" },
    { label: "穩健 (Moderate)", exitPct: 120, reEntryFactor: 0.8, color: "text-blue-400", bg: "bg-gray-800/50", border: "border-gray-700", icon: "text-blue-400" },
    { label: "進取 (Aggressive)", exitPct: 130, reEntryFactor: 0.7, color: "text-purple-400", bg: "bg-gray-800/50", border: "border-gray-700", icon: "text-purple-400" },
  ];

  const suggestedVolume = totalSharesHeld * 0.3;

  // --- Monthly Chart Data (Real API) ---
  const [rawChartData, setRawChartData] = useState<any[]>([]);
  const [isLoadingChart, setIsLoadingChart] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (isLiquidity || !selectedTicker) {
      setRawChartData([]);
      setChartError(null);
      return;
    }

    const fetchChartData = async () => {
      setIsLoadingChart(true);
      setChartError(null);
      try {
        let symbol = selectedTicker.toUpperCase().trim();
        // Check if it's a HK stock (3-5 digits)
        if (/^\d{3,5}$/.test(symbol)) {
          symbol = symbol.padStart(4, '0') + ".HK";
        }

        const endTimestamp = Math.floor(Date.now() / 1000);
        // 3 years ago (approx 1095 days)
        const startTimestamp = endTimestamp - (1095 * 24 * 60 * 60);

        // Add a buffer to startTimestamp (e.g., 1 week before) to be safe
        const bufferSeconds = 7 * 24 * 60 * 60;
        const queryStart = startTimestamp - bufferSeconds;

        const url = `/api/stock/${symbol}?period1=${queryStart}&period2=${endTimestamp}`;
        console.log(`Fetching chart data from: ${url}`);
        const res = await fetch(url);
        
        if (!res.ok) {
          console.error(`Fetch failed with status: ${res.status}`);
          let errorMsg = `無法獲取數據: ${res.statusText}`;
          try {
            const errorData = await res.json();
            if (errorData.error) errorMsg = errorData.error;
          } catch (e) {
            // ignore JSON parse error
          }
          throw new Error(errorMsg);
        }
        
        const json = await res.json();
        if (json.chart && json.chart.result && json.chart.result[0]) {
          const result = json.chart.result[0];
          const timestamps = result.timestamp;
          const quote = result.indicators.quote[0];
          const closes = quote.close;
          const opens = quote.open || closes; // Fallback to close if open is missing
          const highs = quote.high || closes;
          const lows = quote.low || closes;
          
          if (!timestamps || !closes || timestamps.length === 0) {
             throw new Error("無法獲取該股票數據，請檢查代號是否正確或已下市。");
          }

          // Daily Data
          const dailyData = [];

          for (let i = 0; i < timestamps.length; i++) {
            if (closes[i] !== null && closes[i] !== undefined) {
              const date = new Date(timestamps[i] * 1000);
              const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
              
              const currentOpen = opens[i] ?? closes[i];
              const currentHigh = highs[i] ?? closes[i];
              const currentLow = lows[i] ?? closes[i];
              const currentClose = closes[i];

              dailyData.push({
                date: dateStr,
                open: currentOpen,
                high: currentHigh,
                low: currentLow,
                close: currentClose,
                timestamp: timestamps[i]
              });
            }
          }

          const data = dailyData.sort((a, b) => a.timestamp - b.timestamp);

          if (data.length === 0) {
            throw new Error("無法獲取該股票數據，請檢查代號是否正確或已下市。");
          }

          // Calculate MAs on daily data (50-day, 100-day, 250-day)
          for (let i = 0; i < data.length; i++) {
            if (i >= 50) {
              const sum50 = data.slice(i - 50, i).reduce((sum, d) => sum + d.close, 0);
              data[i].ma50 = sum50 / 50;
            }
            if (i >= 100) {
              const sum100 = data.slice(i - 100, i).reduce((sum, d) => sum + d.close, 0);
              data[i].ma100 = sum100 / 100;
            }
            if (i >= 250) {
              const sum250 = data.slice(i - 250, i).reduce((sum, d) => sum + d.close, 0);
              data[i].ma250 = sum250 / 250;
            }
          }
          
          // Filter to only show the last 2 years (approx 730 days)
          const twoYearsAgo = endTimestamp - (730 * 24 * 60 * 60);
          const filteredData = data.filter(d => d.timestamp >= twoYearsAgo);

          setRawChartData(filteredData);
        } else {
          throw new Error("伺服器返回無效數據");
        }
      } catch (e: any) {
        // Only log as warning for expected errors
        if (e.message && e.message.includes("無法獲取該股票數據")) {
          console.warn(`Chart data not found for ${selectedTicker}`);
        } else {
          console.error("Error fetching chart data:", e);
        }
        setRawChartData([]);
        setChartError(e.message || "無法獲取歷史數據");
      } finally {
        setIsLoadingChart(false);
      }
    };

    const timer = setTimeout(() => {
      fetchChartData();
    }, 500);

    return () => clearTimeout(timer);
  }, [selectedTicker, isLiquidity, refreshTrigger]);

  const dailyChartData = useMemo(() => {
    if (rawChartData.length === 0) return [];
    const data = [...rawChartData];
    if (realTimePrice > 0) {
      const last = data[data.length - 1];
      data[data.length - 1] = { 
        ...last, 
        close: realTimePrice,
        high: Math.max(last.high, realTimePrice),
        low: Math.min(last.low, realTimePrice)
      };
    }
    return data;
  }, [rawChartData, realTimePrice]);

  const techAnalysis = useMemo(() => {
    if (dailyChartData.length === 0) return null;
    const lastDataPoint = dailyChartData[dailyChartData.length - 1];
    const ma50 = lastDataPoint.ma50 || 0;
    const ma100 = lastDataPoint.ma100 || 0;
    const ma250 = lastDataPoint.ma250 || 0;
    const price = lastDataPoint.close;
    
    if (ma50 === 0) return null; // Not enough data

    // Calculate recent high/low (last 20 days)
    const last20 = dailyChartData.slice(-20);
    const recentHigh = Math.max(...last20.map(d => d.high));

    let advice = "";
    let entry = 0;
    let exit = 0;
    
    if (price > ma50 && ma50 > ma100) {
      advice = "多頭排列，短期趨勢向上。建議在 50 天均線附近尋找進場機會，並以近期高點作為初步獲利目標。";
      entry = ma50;
      exit = Math.max(recentHigh, price * 1.05);
      if (entry >= exit) exit = entry * 1.1;
    } else if (ma250 > 0 && price < ma250 && price < ma50) {
      advice = "空頭排列，價格處於均線下方。建議等待價格突破 50 天均線後再考慮進場，並以 250 天均線作為反彈離場目標。";
      entry = ma50;
      exit = ma250;
      if (entry >= exit) exit = entry * 1.1;
    } else {
      advice = "價格處於震盪整理區間。建議在 100 天或 250 天等長期均線支撐位進場，並在 50 天均線或近期高點遇阻時離場。";
      entry = ma250 > 0 ? Math.min(ma100, ma250) : ma100;
      exit = Math.max(ma50, recentHigh);
      if (entry >= exit) exit = entry * 1.1;
    }
    
    return { advice, entry, exit, ma50, ma100, ma250 };
  }, [dailyChartData]);

  const reportData = useMemo(() => {
    const timeline: any[] = [];

    if (isLiquidity) {
      // For Liquidity tab, we show the global cash ledger
      // 1. Add initial cash reserve as the first entry
      timeline.push({
        date: new Date(state.aiPlan ? state.aiPlan.startYear : new Date().getFullYear(), state.aiPlan ? state.aiPlan.startMonth - 1 : new Date().getMonth(), 1),
        displayDate: '初始資金 (Initial)',
        type: 'Initial',
        price: 1,
        amount: state.initialCashReserve,
        shares: state.initialCashReserve,
        totalAmount: state.initialCashReserve,
        dividendPerShare: 0,
      });

      // 2. Add all DCA records that affect cash
      state.dcaRecords.forEach(r => {
        let date = new Date(r.year, r.month - 1, 1);
        if (r.period === "15號") {
          date = new Date(r.year, r.month - 1, 15);
        }
        
        const isRecordLiquidity = r.category === "現金儲備／定期" || r.category === "流動資金及定期存款" || (!r.category && (selectedCategory === "現金儲備／定期" || selectedCategory === "流動資金及定期存款"));
        
        if (isRecordLiquidity) {
          timeline.push({
            date: date,
            displayDate: `${r.year}年${r.month}月${r.period ? ` (${r.period})` : ''}`,
            type: 'DCA',
            price: 1,
            amount: r.amount,
            shares: r.amount + (r.dividendPerShare || 0),
            totalAmount: r.amount,
            dividendPerShare: r.dividendPerShare || 0,
          });
        } else if (r.remainder && r.remainder > 0) {
          timeline.push({
            date: date,
            displayDate: `${r.year}年${r.month}月 (餘額)`,
            type: 'Remainder',
            price: 1,
            amount: r.remainder,
            shares: r.remainder,
            totalAmount: r.remainder,
            dividendPerShare: 0,
          });
        }
      });

      // 3. Add all Trade records
      state.tradeRecords.forEach(r => {
        const isPositive = r.type === 'sell' || r.type === 'dividend';
        const amount = r.type === 'withdraw' ? 0 : (isPositive ? r.totalAmount : -r.totalAmount);
        timeline.push({
          date: new Date(r.date),
          displayDate: `${r.date} (${r.ticker})`,
          type: r.type === 'buy' ? 'Trade Buy' : r.type === 'sell' ? 'Trade Sell' : r.type === 'dividend' ? 'Dividend' : 'Withdraw',
          price: 1,
          amount: amount,
          shares: amount,
          totalAmount: amount,
          dividendPerShare: 0,
        });
      });

    } else {
      // Normal category logic
      categoryDCARecords.forEach(r => {
        let date = new Date(r.year, r.month - 1, 1);
        if (r.period === "15號") {
          date = new Date(r.year, r.month - 1, 15);
        }
        timeline.push({
          date: date,
          displayDate: `${r.year}年${r.month}月${r.period ? ` (${r.period})` : ''}`,
          type: 'DCA',
          price: r.price,
          amount: r.amount / exchangeRate,
          amountInHKD: r.amount,
          shares: r.shares,
          totalAmount: r.amount / exchangeRate,
          dividendPerShare: r.dividendPerShare || 0,
        });
      });

      categoryTradeRecords.forEach(r => {
        timeline.push({
          date: new Date(r.date),
          displayDate: r.date,
          type: r.type === 'buy' ? 'Buy' : r.type === 'sell' ? 'Sell' : 'Dividend',
          price: r.price,
          amount: r.totalAmount / exchangeRate,
          amountInHKD: r.totalAmount,
          shares: r.shares,
          totalAmount: (r.type === 'buy' ? r.totalAmount : -r.totalAmount) / exchangeRate,
          dividendPerShare: r.type === 'dividend' ? r.price : 0,
        });
      });
    }

    timeline.sort((a, b) => a.date.getTime() - b.date.getTime());

    let cumulativePrincipal = 0;
    let cumulativeShares = 0;
    let cumulativeDividends = 0;
    
    return timeline.map(item => {
      if (isLiquidity) {
        cumulativePrincipal += item.amount;
        cumulativeShares += item.shares; // For liquidity, shares represents the cash value including interest
        cumulativeDividends += item.dividendPerShare;
        
        return {
          ...item,
          cumulativePrincipal,
          cumulativeShares,
          currentAssetValue: cumulativeShares,
          averageCost: 1,
          percentageDiff: 0,
          dividendReceived: item.dividendPerShare,
          cumulativeDividends,
          totalAssetValueWithDividends: cumulativeShares,
        };
      } else {
        let currentDividend = 0;
        if (item.type === 'DCA' || item.type === 'Buy') {
          cumulativePrincipal += item.amount;
          cumulativeShares += item.shares;
          currentDividend = cumulativeShares * (item.dividendPerShare || 0);
        } else if (item.type === 'Sell') {
          cumulativePrincipal -= item.amount;
          cumulativeShares -= item.shares;
        } else if (item.type === 'Dividend') {
          currentDividend = item.dividendPerShare * item.shares;
        }

        cumulativeDividends += currentDividend;

        const currentAssetValue = cumulativeShares * item.price;
        const totalAssetValueWithDividends = currentAssetValue + cumulativeDividends;
        
        const averageCost = cumulativeShares > 0 ? cumulativePrincipal / cumulativeShares : 0;
        const percentageDiff = averageCost > 0 ? ((item.price - averageCost) / averageCost) * 100 : 0;

        return {
          ...item,
          cumulativePrincipal,
          cumulativePrincipalInHKD: cumulativePrincipal * exchangeRate,
          cumulativeShares,
          currentAssetValue,
          currentAssetValueInHKD: currentAssetValue * exchangeRate,
          averageCost,
          percentageDiff,
          dividendReceived: currentDividend,
          dividendReceivedInHKD: currentDividend * exchangeRate,
          cumulativeDividends,
          totalAssetValueWithDividends,
          totalAssetValueWithDividendsInHKD: totalAssetValueWithDividends * exchangeRate,
        };
      }
    });
  }, [categoryDCARecords, categoryTradeRecords, isLiquidity, state.dcaRecords, state.tradeRecords, state.initialCashReserve, state.aiPlan, selectedCategory]);

  // --- Handlers ---

  const handleSaveDCARecord = () => {
    const baseCategory = selectedCategory.includes(" - ") ? selectedCategory.split(" - ")[0] : selectedCategory;
    const extractedTicker = selectedCategory.includes(" - ") ? selectedCategory.split(" - ")[1] : ticker;

    if (isLiquidity) {
      if (monthlyAmount < 0 || annualInterestRate < 0) return;
      
      const id = `${baseCategory}-${selectedYear}-${selectedMonth}-${selectedPeriod}`;
      const existingRecord = state.dcaRecords.find(r => r.id === id);
      
      // Use global cash reserve as the previous balance for rolling over
      let previousBalance = tradeStats.cashReserve;
      if (existingRecord) {
        previousBalance -= (existingRecord.amount + (existingRecord.dividendPerShare || 0));
      }
      
      let amountToInvest = monthlyAmount;

      const interestEarned = (previousBalance + amountToInvest) * (annualInterestRate / 100 / 12);
      
      addOrUpdateDCARecord({
        id,
        ticker: baseCategory,
        category: baseCategory,
        year: selectedYear,
        month: selectedMonth,
        period: selectedPeriod,
        amount: amountToInvest,
        price: 1,
        shares: amountToInvest + interestEarned, // For liquidity, shares = total value
        remainder: 0,
        dividendPerShare: interestEarned,
      });

    } else {
      if (!extractedTicker || monthlyAmount <= 0 || currentPrice <= 0) return;
      
      const amountInStockCurrency = monthlyAmount / exchangeRate;
      const rawShares = Math.floor(amountInStockCurrency / currentPrice);
      const shares = Math.floor(rawShares / minLotSize) * minLotSize;
      
      const investedAmountInStockCurrency = shares * currentPrice;
      const investedAmount = investedAmountInStockCurrency * exchangeRate;
      const remainder = monthlyAmount - investedAmount;
      
      const id = `${extractedTicker}-${selectedYear}-${selectedMonth}-${selectedPeriod}`;
      
      addOrUpdateDCARecord({
        id,
        ticker: extractedTicker,
        category: baseCategory,
        year: selectedYear,
        month: selectedMonth,
        period: selectedPeriod,
        amount: investedAmount,
        price: currentPrice,
        shares,
        remainder,
        dividendPerShare,
      });
      
      if (realTimePrice === 0) {
        setRealTimePrice(currentPrice);
      }
    }

    // Check which categories are still missing for the CURRENT month
    // Note: state.dcaRecords doesn't have the newly added record yet, so we simulate it
    const isMissing = (cat: string) => {
      if (cat === selectedCategory) return false; // We just added it
      if (noDCAModes[cat]) return false; // Skipped, so not missing
      const catBase = cat.includes(" - ") ? cat.split(" - ")[0] : cat;
      const catTicker = cat.includes(" - ") ? cat.split(" - ")[1] : "";
      return !state.dcaRecords.some(r => r.year === selectedYear && r.month === selectedMonth && (r.category === catBase && (catTicker ? r.ticker === catTicker : true) || (!r.category && catBase === "一般定投")));
    };

    const missingCategories = categories.filter(isMissing);

    if (missingCategories.length > 0) {
      // Auto-switch to the next missing category
      setSelectedCategory(missingCategories[0]);
    } else {
      // All categories for this month are filled!
      let nextMonth = selectedMonth + 1;
      let nextYear = selectedYear;
      if (nextMonth > 12) {
        nextMonth = 1;
        nextYear += 1;
      }
      setSelectedMonth(nextMonth);
      setSelectedYear(nextYear);
      setSelectedCategory(categories[0]);
    }
  };

  const handleTrade = () => {
    if (tradePrice <= 0 || tradeShares <= 0) return;
    
    const totalAmountInStockCurrency = tradePrice * tradeShares;
    const totalAmount = totalAmountInStockCurrency * exchangeRate;
    
    if (tradeType === 'buy') {
       if (tradeStats.cashReserve < totalAmount) {
         alert("現金儲備不足！(Insufficient Cash Reserve)");
         return;
       }
    } else if (tradeType === 'sell') {
      if (totalSharesHeld < tradeShares) {
        alert("持股不足！(Insufficient Shares)");
        return;
      }
    }

    const formattedDate = `${tradeYear}-${String(tradeMonth).padStart(2, '0')}-01`;

    addTradeRecord({
      id: Date.now().toString(),
      ticker: ticker || selectedCategory,
      category: selectedCategory,
      type: tradeType as 'buy' | 'sell' | 'withdraw' | 'dividend',
      date: formattedDate,
      price: tradePrice,
      shares: tradeType === 'dividend' ? 0 : tradeShares,
      totalAmount,
    });
    
    setTradeShares(0);
  };

  const handleExport = () => {
    const data = {
      dcaRecords: state.dcaRecords,
      tradeRecords: state.tradeRecords,
      initialCashReserve: state.initialCashReserve,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dca_records_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.dcaRecords && Array.isArray(json.dcaRecords) && json.tradeRecords && Array.isArray(json.tradeRecords)) {
          importDCADataset(json.dcaRecords, json.tradeRecords, json.initialCashReserve || 0);
          alert("匯入成功！");
        } else {
          alert("檔案格式錯誤 (Invalid File Format)");
        }
      } catch (err) {
        alert("無法解析檔案 (Failed to parse file)");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleExportJPEG = async () => {
    if (!reportRef.current) return;
    try {
      const printContainer = document.createElement('div');
      printContainer.style.position = 'absolute';
      printContainer.style.top = '-9999px';
      printContainer.style.left = '0';
      printContainer.style.backgroundColor = '#ffffff';
      printContainer.style.padding = '24px';
      printContainer.classList.add('print-force-expand');
      
      const clone = reportRef.current.cloneNode(true) as HTMLElement;
      
      clone.classList.remove('h-full', 'w-full');
      clone.style.height = 'auto';
      clone.style.width = 'max-content';
      clone.style.minWidth = '100%';
      
      const style = document.createElement('style');
      style.innerHTML = `
        .print-force-expand * {
          overflow: visible !important;
          max-width: none !important;
          max-height: none !important;
        }
        .print-force-expand .min-w-\\[1200px\\] {
          width: max-content !important;
          min-width: 100% !important;
        }
        .print-force-expand .min-w-\\[1200px\\] .grid {
          width: max-content !important;
          min-width: 100% !important;
        }
        .print-force-expand .min-w-\\[1200px\\] .grid > div {
          white-space: nowrap !important;
        }
      `;
      printContainer.appendChild(style);
      printContainer.appendChild(clone);
      document.body.appendChild(printContainer);

      await new Promise(resolve => setTimeout(resolve, 500));

      let maxWidth = 1600;
      const allElements = printContainer.querySelectorAll('*');
      allElements.forEach(el => {
        if (el.scrollWidth > maxWidth) {
          maxWidth = el.scrollWidth;
        }
      });

      maxWidth += 48;

      printContainer.style.width = `${maxWidth}px`;
      clone.style.width = `${maxWidth}px`;

      const dataUrl = await toJpeg(printContainer, {
        quality: 0.95,
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        width: maxWidth,
        filter: (node: any) => {
          if (node.getAttribute && node.getAttribute('data-html2canvas-ignore')) {
            return false;
          }
          return true;
        },
      });

      document.body.removeChild(printContainer);
      
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `dca_report_${new Date().toISOString().split('T')[0]}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error("Failed to export JPEG", err);
      alert("匯出圖片失敗 (Failed to export image)");
    }
  };

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    try {
      const printContainer = document.createElement('div');
      printContainer.style.position = 'absolute';
      printContainer.style.top = '-9999px';
      printContainer.style.left = '0';
      printContainer.style.backgroundColor = '#ffffff';
      printContainer.style.padding = '24px';
      printContainer.classList.add('print-force-expand');
      
      const clone = reportRef.current.cloneNode(true) as HTMLElement;
      
      clone.classList.remove('h-full', 'w-full');
      clone.style.height = 'auto';
      clone.style.width = 'max-content';
      clone.style.minWidth = '100%';
      
      const style = document.createElement('style');
      style.innerHTML = `
        .print-force-expand * {
          overflow: visible !important;
          max-width: none !important;
          max-height: none !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
        }
        .print-force-expand .bg-white\\/80, 
        .print-force-expand .bg-white\\/50,
        .print-force-expand .bg-gray-50\\/80,
        .print-force-expand .bg-blue-50\\/80,
        .print-force-expand .bg-yellow-50\\/80,
        .print-force-expand .bg-indigo-50\\/80,
        .print-force-expand .bg-emerald-50\\/80,
        .print-force-expand .bg-purple-50\\/80 {
          background-color: #ffffff !important;
        }
        .print-force-expand .min-w-\\[1200px\\] {
          width: max-content !important;
          min-width: 100% !important;
        }
        .print-force-expand .min-w-\\[1200px\\] .grid {
          width: max-content !important;
          min-width: 100% !important;
        }
        .print-force-expand .min-w-\\[1200px\\] .grid > div {
          white-space: nowrap !important;
        }
      `;
      printContainer.appendChild(style);
      printContainer.appendChild(clone);
      document.body.appendChild(printContainer);

      await new Promise(resolve => setTimeout(resolve, 500));

      let maxWidth = 1600;
      const allElements = printContainer.querySelectorAll('*');
      allElements.forEach(el => {
        if (el.scrollWidth > maxWidth) {
          maxWidth = el.scrollWidth;
        }
      });

      maxWidth += 48;

      printContainer.style.width = `${maxWidth}px`;
      clone.style.width = `${maxWidth}px`;

      const dataUrl = await toJpeg(printContainer, {
        quality: 0.95,
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        width: maxWidth,
        filter: (node: any) => {
          if (node.getAttribute && node.getAttribute('data-html2canvas-ignore')) {
            return false;
          }
          return true;
        },
      });

      document.body.removeChild(printContainer);

      // Create a temporary image to get dimensions
      const img = new Image();
      img.src = dataUrl;
      await new Promise(resolve => img.onload = resolve);

      // Always use landscape for overall report to fit wide tables
      const pdf = new jsPDF({
        orientation: 'l',
        unit: 'px',
        format: [img.width, img.height]
      });

      pdf.addImage(dataUrl, 'JPEG', 0, 0, img.width, img.height);
      pdf.save(`dca_report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error("Failed to export PDF", err);
      alert("匯出 PDF 失敗 (Failed to export PDF)");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto space-y-8 pb-24"
    >
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-700 p-8 rounded-3xl shadow-xl border border-blue-500/30 text-white mb-8 group">
        <div className="absolute top-0 right-0 -mt-16 -mr-16 w-80 h-80 bg-white opacity-10 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-1000"></div>
        <div className="absolute bottom-0 left-0 -mb-16 -ml-16 w-64 h-64 bg-blue-300 opacity-20 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-1000"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-md border border-white/20 shadow-inner">
              <History className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2 drop-shadow-sm">
                定投記錄 (DCA Records)
              </h1>
              <p className="text-blue-100 text-lg font-medium">
                管理定期投資，結合 AI 建議優化進出場策略
              </p>
            </div>
          </div>
          
          <div className="flex gap-3">
             <button 
               onClick={() => setShowOverallReport(true)}
               className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white backdrop-blur-md border border-emerald-400 rounded-xl transition-all text-sm font-bold shadow-lg"
             >
               <FileText className="w-4 h-4" /> 生成總報告
             </button>
             <button 
               onClick={handleExport}
               className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-xl transition-all text-sm font-bold"
             >
               <Download className="w-4 h-4" /> 匯出
             </button>
             <button 
               onClick={handleImportClick}
               className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-xl transition-all text-sm font-bold"
             >
               <Upload className="w-4 h-4" /> 匯入
             </button>
             <input 
               type="file" 
               ref={fileInputRef} 
               onChange={handleImportFile} 
               className="hidden" 
               accept=".json"
             />
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
        {categories.map(cat => {
          const catBase = cat.includes(" - ") ? cat.split(" - ")[0] : cat;
          const catTicker = cat.includes(" - ") ? cat.split(" - ")[1] : "";
          const hasRecord = noDCAModes[cat] || state.dcaRecords.some(r => r.year === selectedYear && r.month === selectedMonth && (r.category === catBase && (catTicker ? r.ticker === catTicker : true) || (!r.category && catBase === "一般定投")));
          
          let tabClass = "";
          if (selectedCategory === cat) {
            tabClass = hasRecord 
              ? "bg-blue-600 text-white shadow-md ring-2 ring-offset-2 ring-blue-500" 
              : "bg-rose-600 text-white shadow-md ring-2 ring-offset-2 ring-rose-500";
          } else {
            tabClass = hasRecord
              ? "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
              : "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100";
          }

          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-6 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${tabClass}`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: DCA Input & List */}
        <div className="lg:col-span-1 space-y-8">
          {/* DCA Input Form */}
          <div className="bg-white/80 backdrop-blur-xl p-6 rounded-3xl shadow-lg border border-white/50">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-600" /> 新增記錄 ({selectedCategory})
              </h2>
              {!isLiquidity && (
                <button
                  onClick={() => toggleNoDCA(selectedCategory)}
                  className={`text-sm font-bold px-3 py-1.5 rounded-lg transition-colors ${noDCAModes[selectedCategory] ? 'bg-rose-100 text-rose-600 hover:bg-rose-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {noDCAModes[selectedCategory] ? '恢復定投' : '不作定投'}
                </button>
              )}
            </div>
            
            {noDCAModes[selectedCategory] && !isLiquidity ? (
              <div className="text-center py-8 bg-gray-50 rounded-2xl border border-gray-100">
                <Target className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium mb-2">已選擇不作定投</p>
                <p className="text-sm text-gray-400">請在右側「低買高賣操作」區使用初始資金進行長遠投資買賣。</p>
              </div>
            ) : (
              <div className="space-y-4">
                {!isLiquidity && (
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">股票代號 (Ticker)</label>
                    <input
                      type="text"
                      value={ticker}
                      onChange={(e) => updateTabInput('ticker', e.target.value.toUpperCase())}
                      placeholder="e.g. 0700.HK"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-bold text-gray-900"
                    />
                  </div>
                )}
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">每次定投金額 ($)</label>
                <input
                  type="number"
                  value={monthlyAmount || ''}
                  onChange={(e) => updateTabInput('monthlyAmount', Number(e.target.value))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-bold text-gray-900"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">年份</label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                  >
                    {[...Array(10)].map((_, i) => {
                      const y = new Date().getFullYear() - 5 + i;
                      return <option key={y} value={y}>{y}年</option>;
                    })}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">月份</label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                  >
                    {[...Array(12)].map((_, i) => (
                      <option key={i + 1} value={i + 1}>{i + 1}月</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">頻率/日期</label>
                  <select
                    value={selectedPeriod}
                    onChange={(e) => setSelectedPeriod(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                  >
                    <option value="1號">1號 (每半月)</option>
                    <option value="15號">15號 (每半月)</option>
                    <option value="每一個月">每一個月</option>
                    <option value="每兩個月">每兩個月</option>
                  </select>
                </div>
              </div>

              {isLiquidity ? (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">年厘率 (%)</label>
                  <input
                    type="number"
                    value={annualInterestRate || ''}
                    onChange={(e) => updateTabInput('annualInterestRate', Number(e.target.value))}
                    placeholder="e.g. 4.5"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-bold text-gray-900"
                  />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">當時股價 ($)</label>
                      <input
                        type="number"
                        value={currentPrice || ''}
                        onChange={(e) => updateTabInput('currentPrice', Number(e.target.value))}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-bold text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">匯率 (預設 {isUSStock ? '7.8' : '1'})</label>
                      <input
                        type="number"
                        value={exchangeRate || ''}
                        onChange={(e) => updateTabInput('exchangeRate', Number(e.target.value))}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-bold text-gray-900"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">當月每股派息 ($)</label>
                      <input
                        type="number"
                        value={dividendPerShare || ''}
                        onChange={(e) => updateTabInput('dividendPerShare', Number(e.target.value))}
                        placeholder="0"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-bold text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">最低每手股數</label>
                      <input
                        type="number"
                        value={minLotSize || ''}
                        onChange={(e) => updateTabInput('minLotSize', Number(e.target.value))}
                        placeholder="1"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-bold text-gray-900"
                      />
                    </div>
                  </div>

                  {monthlyAmount > 0 && currentPrice > 0 && (
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                      <p className="text-sm text-blue-600 font-bold">可買股份數目:</p>
                      <p className="text-2xl font-extrabold text-blue-800">
                        {Math.floor(Math.floor((monthlyAmount / exchangeRate) / currentPrice) / minLotSize) * minLotSize} 股
                      </p>
                      <p className="text-xs text-blue-500 mt-1 font-bold">
                        餘額 ${(monthlyAmount - (Math.floor(Math.floor((monthlyAmount / exchangeRate) / currentPrice) / minLotSize) * minLotSize) * currentPrice * exchangeRate).toFixed(2)} 將自動轉入現金儲備
                      </p>
                    </div>
                  )}
                </>
              )}

              <button
                onClick={handleSaveDCARecord}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-200 transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2"
              >
                <Save className="w-5 h-5" /> 儲存記錄
              </button>
            </div>
            )}
          </div>

          {/* DCA Records List */}
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-lg border border-white/50 max-h-[500px] flex flex-col relative overflow-hidden">
            <div className="p-6 bg-white border-b border-gray-100 shrink-0 z-20">
              <h2 className="text-lg font-bold text-gray-900">
                過往記錄 ({selectedCategory})
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-3">
              {categoryDCARecords.length === 0 ? (
                <p className="text-gray-400 text-center py-8">暫無記錄</p>
              ) : (
                categoryDCARecords.map((record) => (
                  <div key={record.id} className="bg-gray-50 p-4 rounded-2xl border border-gray-100 hover:shadow-md transition-all group relative">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md">{record.ticker}</span>
                        <h3 className="font-bold text-gray-900 mt-1">{record.year}年{record.month}月 {record.period && `(${record.period})`}</h3>
                      </div>
                      <button 
                        onClick={() => deleteDCARecord(record.id)}
                        className="text-gray-400 hover:text-red-500 p-1 rounded-full hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-gray-500 text-xs">投入金額</p>
                        <p className="font-bold text-gray-900">${record.amount.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">{isLiquidity ? '利息收入' : '買入價'}</p>
                        <p className="font-bold text-gray-900">${isLiquidity ? (record.dividendPerShare || 0).toFixed(2) : record.price}</p>
                      </div>
                      {!isLiquidity && (
                        <div className="col-span-2 pt-2 border-t border-gray-200 mt-1">
                          <p className="text-gray-500 text-xs">買入股份</p>
                          <p className="font-bold text-blue-600">{record.shares.toFixed(2)} 股</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Overview & Trading */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Asset Overview */}
          <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-xl border border-white/50 relative overflow-hidden">
             <div className="absolute inset-0 bg-gradient-to-r from-emerald-50/30 to-blue-50/30 pointer-events-none" />
             
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 relative z-10 gap-4">
               <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                 <Wallet className="w-6 h-6 text-emerald-600" /> 資產總覽 ({selectedCategory})
               </h2>
               <div className="flex items-center gap-3">
                 {!isLiquidity && (
                   <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-gray-200 shadow-sm">
                     <span className="text-sm font-bold text-gray-500">實時現價:</span>
                     <span className="text-emerald-600 font-bold">$</span>
                     <input 
                       type="number" 
                       value={realTimePrice || ''} 
                       onChange={(e) => setRealTimePrice(Number(e.target.value))}
                       className="w-24 font-bold text-gray-900 border-none bg-transparent focus:ring-0 p-0"
                     />
                   </div>
                 )}
                 <button
                   onClick={() => setShowReport(true)}
                   className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-200 transition-all hover:-translate-y-0.5"
                 >
                   <FileText className="w-4 h-4" /> 生成報告
                 </button>
               </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
               <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                 <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">總投入本金</p>
                 <p className="text-2xl font-extrabold text-blue-600">
                   ${isUSStock ? (dcaStats.totalInvested / exchangeRate).toLocaleString(undefined, { maximumFractionDigits: 2 }) : dcaStats.totalInvested.toLocaleString()}
                   {isUSStock && <span className="text-sm font-normal text-gray-500 ml-1 block">(HKD ${dcaStats.totalInvested.toLocaleString()})</span>}
                 </p>
               </div>
               <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                 <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">{isLiquidity ? '總結餘' : '總持貨量'}</p>
                 <p className="text-2xl font-extrabold text-gray-900">{totalSharesHeld.toFixed(2)} {isLiquidity ? '' : <span className="text-sm font-normal text-gray-400">股</span>}</p>
               </div>
               <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                 <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">資產總值</p>
                 <p className="text-2xl font-extrabold text-emerald-600">
                   ${isLiquidity ? totalSharesHeld.toLocaleString() : (isUSStock ? (totalAssetValue / exchangeRate).toLocaleString(undefined, { maximumFractionDigits: 2 }) : totalAssetValue.toLocaleString())}
                   {!isLiquidity && isUSStock && <span className="text-sm font-normal text-gray-500 ml-1 block">(HKD ${totalAssetValue.toLocaleString()})</span>}
                 </p>
               </div>
               <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                 <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">戶口總值 (含現金)</p>
                 <p className="text-2xl font-extrabold text-indigo-600">
                   ${isLiquidity ? totalSharesHeld.toLocaleString() : (isUSStock ? ((totalAssetValue + tradeStats.cashReserve) / exchangeRate).toLocaleString(undefined, { maximumFractionDigits: 2 }) : (totalAssetValue + tradeStats.cashReserve).toLocaleString())}
                   {!isLiquidity && isUSStock && <span className="text-sm font-normal text-gray-500 ml-1 block">(HKD ${(totalAssetValue + tradeStats.cashReserve).toLocaleString()})</span>}
                 </p>
               </div>
               <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-5 rounded-2xl border border-amber-100 shadow-sm md:col-span-2 lg:col-span-4">
                 <div className="flex justify-between items-center mb-1">
                   <p className="text-xs text-amber-600 font-bold uppercase tracking-wider">全局現金儲備</p>
                   <div className="flex items-center gap-1">
                      <span className="text-[10px] text-amber-500 font-bold">初始: $</span>
                      <input 
                        type="number" 
                        value={state.initialCashReserve || ''} 
                        onChange={(e) => setInitialCashReserve(Number(e.target.value))}
                        placeholder="0"
                        className="w-16 text-xs font-bold text-amber-700 bg-white/50 border border-amber-200 rounded px-1 py-0.5 focus:ring-1 focus:ring-amber-500"
                      />
                   </div>
                 </div>
                 <p className="text-2xl font-extrabold text-amber-700">${tradeStats.cashReserve.toLocaleString()}</p>
               </div>
             </div>
          </div>

          {/* AI Entry/Exit Advice (Hide for Liquidity) */}
          {!isLiquidity && dcaStats.avgPrice > 0 && (
            <div className="bg-gray-900 p-8 rounded-3xl shadow-xl border border-gray-800">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg">
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">AI 進出場建議</h2>
                  <p className="text-sm text-gray-400 font-medium">基於平均成本 ${dcaStats.avgPrice.toFixed(2)} 的策略參考</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {adviceLevels.map((level, idx) => {
                  const targetExit = dcaStats.avgPrice * (level.exitPct / 100);
                  const targetEntry = targetExit * level.reEntryFactor;
                  
                  return (
                    <div key={idx} className={`rounded-2xl p-5 border ${level.border} ${level.bg} hover:shadow-md transition-all relative overflow-hidden group`}>
                      <div className={`absolute top-0 right-0 -mt-8 -mr-8 w-24 h-24 bg-white opacity-5 rounded-full blur-xl group-hover:scale-150 transition-transform duration-700`}></div>
                      <h3 className={`font-bold ${level.color} mb-4 text-lg`}>{level.label}</h3>
                      
                      <div className="space-y-4">
                        <div className="bg-gray-800 rounded-xl p-3 border border-gray-700 shadow-sm">
                          <p className={`text-xs ${level.color} font-bold uppercase tracking-wider mb-1 flex items-center gap-1`}>
                            <TrendingUp className={`w-3 h-3 ${level.icon}`} /> 止盈目標 ({level.exitPct}%)
                          </p>
                          <p className="text-2xl font-extrabold text-white">${targetExit.toFixed(2)}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            建議賣出: <span className="font-bold text-gray-300">{suggestedVolume.toFixed(2)} 股</span>
                          </p>
                        </div>
                        
                        <div className="bg-gray-800 rounded-xl p-3 border border-gray-700 shadow-sm">
                          <p className={`text-xs ${level.color} font-bold uppercase tracking-wider mb-1 flex items-center gap-1`}>
                            <TrendingDown className={`w-3 h-3 ${level.icon}`} /> 接回目標 (-{Math.round((1 - level.reEntryFactor) * 100)}%)
                          </p>
                          <p className="text-2xl font-extrabold text-white">${targetEntry.toFixed(2)}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            預期利潤: <span className={`font-bold ${level.color}`}>${((targetExit - targetEntry) * suggestedVolume).toFixed(2)}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-8 pt-8 border-t border-gray-800">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-indigo-400" /> 技術分析估算 (Technical Analysis)
                  </h3>
                  <button
                    onClick={() => setRefreshTrigger(prev => prev + 1)}
                    disabled={isLoadingChart}
                    className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 rounded-lg border border-gray-700 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoadingChart ? 'animate-spin' : ''}`} />
                    更新
                  </button>
                </div>
                
                {isLoadingChart ? (
                  <div className="flex items-center justify-center h-64 bg-gray-800 rounded-2xl border border-gray-700 mb-6">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-gray-400 text-sm font-medium">正在載入歷史數據...</p>
                    </div>
                  </div>
                ) : chartError ? (
                  <div className="flex items-center justify-center h-64 bg-gray-800 rounded-2xl border border-gray-700 mb-6">
                    <div className="flex flex-col items-center gap-3 text-rose-400">
                      <TrendingDown className="w-8 h-8" />
                      <p className="text-sm font-medium">{chartError}</p>
                      <p className="text-xs text-gray-500">請檢查股票代號是否正確 (例如: AAPL, 2330.TW)</p>
                    </div>
                  </div>
                ) : dailyChartData.length > 0 ? (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                    <div className="lg:col-span-2 bg-gray-800 rounded-2xl p-4 border border-gray-700">
                      <div className="h-64 w-full">
                        <CandlestickChart data={dailyChartData} realTimePrice={realTimePrice} />
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      {techAnalysis ? (
                        <>
                          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-2">趨勢簡說</p>
                            <p className="text-sm text-gray-300 leading-relaxed">{techAnalysis.advice}</p>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                              <p className="text-xs text-emerald-400 font-bold uppercase tracking-wider mb-1">建議進場</p>
                              <p className="text-xl font-bold text-white">${techAnalysis.entry.toFixed(2)}</p>
                            </div>
                            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                              <p className="text-xs text-rose-400 font-bold uppercase tracking-wider mb-1">建議離場</p>
                              <p className="text-xl font-bold text-white">${techAnalysis.exit.toFixed(2)}</p>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 h-full flex items-center justify-center">
                          <p className="text-sm text-gray-500 italic">數據不足以進行技術分析</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : !isLiquidity ? (
                  <div className="flex items-center justify-center h-64 bg-gray-800 rounded-2xl border border-gray-700 mb-6">
                    <div className="text-center space-y-2">
                       <p className="text-gray-400 text-sm">
                         {selectedTicker ? "無可用數據，請點擊更新或檢查代號" : "未偵測到股票代號，請確保類別名稱包含 ' - 代號' (例如: 科技股 - AAPL)"}
                       </p>
                       {selectedTicker && (
                         <p className="text-xs text-gray-500">當前識別代號: <span className="text-indigo-400 font-mono">{selectedTicker}</span></p>
                       )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* Trading Interface (Hide for Liquidity) */}
          {!isLiquidity && (
            <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-lg border border-white/50">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <ArrowRightLeft className="w-6 h-6 text-gray-700" /> 低買高賣操作 (Trading)
              </h2>
              
              <div className="flex flex-col md:flex-row gap-8">
                {/* Trade Form */}
                <div className="flex-1 space-y-4">
                   <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
                     <button
                       onClick={() => setTradeType('buy')}
                       className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${tradeType === 'buy' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                     >
                       買入 (Buy)
                     </button>
                     <button
                       onClick={() => setTradeType('sell')}
                       className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${tradeType === 'sell' ? 'bg-white text-rose-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                     >
                       賣出 (Sell)
                     </button>
                     <button
                       onClick={() => setTradeType('dividend')}
                       className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${tradeType === 'dividend' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                     >
                       收息 (Dividend)
                     </button>
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                     <div>
                       <label className="block text-sm font-bold text-gray-700 mb-1">年份</label>
                       <select
                         value={tradeYear}
                         onChange={(e) => setTradeYear(Number(e.target.value))}
                         className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                       >
                         {[...Array(10)].map((_, i) => {
                           const y = new Date().getFullYear() - 5 + i;
                           return <option key={y} value={y}>{y}年</option>;
                         })}
                       </select>
                     </div>
                     <div>
                       <label className="block text-sm font-bold text-gray-700 mb-1">月份</label>
                       <select
                         value={tradeMonth}
                         onChange={(e) => setTradeMonth(Number(e.target.value))}
                         className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                       >
                         {[...Array(12)].map((_, i) => (
                           <option key={i + 1} value={i + 1}>{i + 1}月</option>
                         ))}
                       </select>
                     </div>
                   </div>

                   {tradeType === 'dividend' ? (
                     <div>
                       <div className="flex justify-between items-end mb-1">
                         <label className="block text-sm font-bold text-gray-700">每股派息金額 ($)</label>
                         <span className="text-xs font-medium text-blue-600">
                           當時持股: {sharesAtTradeDate.toFixed(4)} 股
                         </span>
                       </div>
                       <input
                         type="number"
                         value={tradePrice || ''}
                         onChange={(e) => {
                           setTradePrice(Number(e.target.value));
                           setTradeShares(sharesAtTradeDate);
                         }}
                         className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                       />
                     </div>
                   ) : (
                     <>
                       <div>
                         <label className="block text-sm font-bold text-gray-700 mb-1">交易價格 ($)</label>
                         <input
                           type="number"
                           value={tradePrice || ''}
                           onChange={(e) => setTradePrice(Number(e.target.value))}
                           className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                         />
                       </div>

                       <div>
                         <div className="flex justify-between items-end mb-1">
                           <label className="block text-sm font-bold text-gray-700">股份數目</label>
                           {tradeType === 'buy' && tradePrice > 0 && (
                             <span className="text-xs font-medium text-emerald-600">
                               最高可購買: {(tradeStats.cashReserve / tradePrice).toFixed(4)} 股
                             </span>
                           )}
                           {tradeType === 'sell' && (
                             <span className="text-xs font-medium text-rose-600">
                               最高可賣出: {totalSharesHeld.toFixed(4)} 股
                             </span>
                           )}
                         </div>
                         <input
                           type="number"
                           value={tradeShares || ''}
                           onChange={(e) => setTradeShares(Number(e.target.value))}
                           className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 font-bold text-gray-900"
                         />
                       </div>
                     </>
                   )}

                   <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex justify-between items-center">
                     <span className="text-sm font-bold text-gray-500">總金額 (HKD):</span>
                     <span className="text-xl font-extrabold text-gray-900">${(tradePrice * tradeShares * exchangeRate).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                   </div>

                   <button
                     onClick={handleTrade}
                     className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 ${tradeType === 'buy' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200' : tradeType === 'sell' ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'}`}
                   >
                     確認{tradeType === 'buy' ? '買入' : tradeType === 'sell' ? '賣出' : '收息'}
                   </button>
                </div>

                {/* Trade History */}
                <div className="flex-1 border-l border-gray-100 pl-0 md:pl-8 pt-8 md:pt-0">
                  <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar relative">
                    <h3 className="font-bold text-gray-700 mb-2 sticky top-0 bg-white/95 backdrop-blur-sm py-2 z-10 border-b border-gray-100 flex items-center gap-2">
                      <History className="w-4 h-4 text-blue-500" /> 交易記錄
                    </h3>
                    {categoryTradeRecords.filter(t => t.type !== 'withdraw').length === 0 ? (
                      <p className="text-gray-400 text-sm py-4 text-center">暫無交易記錄</p>
                    ) : (
                      categoryTradeRecords.filter(t => t.type !== 'withdraw').map(trade => (
                        <div key={trade.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100 hover:shadow-sm transition-all">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded ${trade.type === 'buy' ? 'bg-emerald-100 text-emerald-700' : trade.type === 'sell' ? 'bg-rose-100 text-rose-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                {trade.type === 'buy' ? '買入' : trade.type === 'sell' ? '賣出' : '收息'}
                              </span>
                              <span className="text-xs text-gray-500">{trade.date}</span>
                            </div>
                            <p className="text-sm font-bold text-gray-900 mt-1">
                              {trade.type === 'dividend' ? `總金額: $${trade.totalAmount}` : `$${trade.price} x ${trade.shares}股`}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-gray-900">${trade.totalAmount.toLocaleString()}</p>
                            <button 
                              onClick={() => deleteTradeRecord(trade.id)}
                              className="text-xs text-red-400 hover:text-red-600 mt-1 flex items-center justify-end gap-1 w-full"
                            >
                              <Trash2 className="w-3 h-3" /> 刪除
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Withdrawal Interface (For Liquidity) */}
          {isLiquidity && (
            <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-lg border border-white/50">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <ArrowRightLeft className="w-6 h-6 text-amber-600" /> 退金操作 (Withdraw to Cash Reserve)
              </h2>
              
              <div className="flex flex-col md:flex-row gap-8">
                {/* Withdraw Form */}
                <div className="flex-1 space-y-4">
                   <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 mb-4">
                     <p className="text-sm text-amber-800 font-medium">
                       終止計劃並將資金連本帶利轉入「全局現金儲備」。
                     </p>
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                     <div>
                       <label className="block text-sm font-bold text-gray-700 mb-1">年份</label>
                       <select
                         value={tradeYear}
                         onChange={(e) => setTradeYear(Number(e.target.value))}
                         className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-amber-500 font-bold text-gray-900"
                       >
                         {[...Array(10)].map((_, i) => {
                           const y = new Date().getFullYear() - 5 + i;
                           return <option key={y} value={y}>{y}年</option>;
                         })}
                       </select>
                     </div>
                     <div>
                       <label className="block text-sm font-bold text-gray-700 mb-1">月份</label>
                       <select
                         value={tradeMonth}
                         onChange={(e) => setTradeMonth(Number(e.target.value))}
                         className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-amber-500 font-bold text-gray-900"
                       >
                         {[...Array(12)].map((_, i) => (
                           <option key={i + 1} value={i + 1}>{i + 1}月</option>
                         ))}
                       </select>
                     </div>
                   </div>

                   <div>
                     <div className="flex justify-between items-end mb-1">
                       <label className="block text-sm font-bold text-gray-700">退金金額 ($)</label>
                       <span className="text-xs font-medium text-amber-600">
                         最高可退: ${tradeStats.liquidityValue.toLocaleString()}
                       </span>
                     </div>
                     <input
                       type="number"
                       value={tradePrice || ''}
                       onChange={(e) => setTradePrice(Number(e.target.value))}
                       placeholder="輸入退金金額"
                       className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-amber-500 font-bold text-gray-900"
                     />
                   </div>

                   <button
                     onClick={() => {
                       if (tradePrice <= 0) return;
                       if (tradePrice > tradeStats.liquidityValue) {
                         alert("退金金額不能超過目前總結餘！(Withdrawal amount cannot exceed total balance)");
                         return;
                       }
                       const formattedDate = `${tradeYear}-${String(tradeMonth).padStart(2, '0')}-01`;
                       addTradeRecord({
                         id: Date.now().toString(),
                         ticker: selectedCategory,
                         category: selectedCategory,
                         type: 'withdraw',
                         date: formattedDate,
                         price: 1,
                         shares: tradePrice,
                         totalAmount: tradePrice,
                       });
                       setTradePrice(0);
                     }}
                     className="w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 bg-amber-600 hover:bg-amber-700 shadow-amber-200"
                   >
                     確認退金
                   </button>
                </div>

                {/* Withdraw History */}
                <div className="flex-1 border-l border-gray-100 pl-0 md:pl-8 pt-8 md:pt-0">
                  <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar relative">
                    <h3 className="font-bold text-gray-700 mb-2 sticky top-0 bg-white/95 backdrop-blur-sm py-2 z-10 border-b border-gray-100 flex items-center gap-2">
                      <History className="w-4 h-4 text-amber-500" /> 退金記錄
                    </h3>
                    {categoryTradeRecords.filter(t => t.type === 'withdraw').length === 0 ? (
                      <p className="text-gray-400 text-sm py-4 text-center">暫無退金記錄</p>
                    ) : (
                      categoryTradeRecords.filter(t => t.type === 'withdraw').map(trade => (
                        <div key={trade.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100 hover:shadow-sm transition-all">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-700">
                                退金
                              </span>
                              <span className="text-sm font-bold text-gray-900">{trade.date.substring(0, 7)}</span>
                            </div>
                          </div>
                          <div className="text-right flex items-center gap-3">
                            <span className="font-bold text-amber-600">
                              -${trade.totalAmount.toLocaleString()}
                            </span>
                            <button 
                              onClick={() => deleteTradeRecord(trade.id)}
                              className="text-gray-400 hover:text-red-500 p-1 rounded-full hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Report Modal */}
      <AnimatePresence>
        {showReport && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl h-[90vh] overflow-hidden flex flex-col relative"
            >
              <div ref={reportRef} className="flex flex-col h-full bg-white relative" style={{ backgroundColor: '#ffffff', color: '#111827' }}>
                <div className="p-6 border-b border-gray-100 flex justify-between items-center shrink-0 z-20 bg-white" style={{ backgroundColor: '#f9fafb' }}>
                  <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <FileText className="w-6 h-6 text-blue-600" /> 定投及交易報告 ({selectedCategory})
                  </h2>
                  <button
                    onClick={() => setShowReport(false)}
                    className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                    data-html2canvas-ignore="true"
                  >
                    <X className="w-6 h-6 text-gray-500" />
                  </button>
                </div>
                
                <div id="report-scroll-container" className="flex-1 flex flex-col min-h-0 relative z-10">
                  {/* Chart Section - Fixed */}
                  <div className="h-64 mb-4 w-full shrink-0 px-6 pt-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={reportData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        <XAxis 
                          dataKey="displayDate" 
                          tick={{ fontSize: 10, fill: '#6b7280' }} 
                          axisLine={false} 
                          tickLine={false} 
                          interval="preserveStartEnd"
                        />
                        <YAxis 
                          tick={{ fontSize: 10, fill: '#6b7280' }} 
                          axisLine={false} 
                          tickLine={false} 
                          tickFormatter={(value) => `$${value}`}
                          domain={['auto', 'auto']}
                        />
                        <Tooltip 
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                          formatter={(value: number) => [`$${value.toFixed(2)}`, '']}
                          labelStyle={{ color: '#374151', fontWeight: 'bold' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                        {isLiquidity ? (
                          <>
                            <Line 
                              type="monotone" 
                              dataKey="currentAssetValue" 
                              stroke="#2563eb" 
                              strokeWidth={2} 
                              dot={<CustomDot />} 
                              activeDot={{ r: 6 }}
                              name={isUSStock ? "結餘 (Balance USD)" : "結餘 (Balance)"}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="totalAssetValueWithDividends" 
                              stroke="#059669" 
                              strokeWidth={2} 
                              dot={false}
                              activeDot={{ r: 6 }}
                              name={isUSStock ? "總資產價值 (Total Asset Value USD)" : "總資產價值 (Total Asset Value)"}
                            />
                          </>
                        ) : (
                          <>
                            <Line 
                              type="monotone" 
                              dataKey="price" 
                              stroke="#2563eb" 
                              strokeWidth={2} 
                              dot={<CustomDot />} 
                              activeDot={{ r: 6 }}
                              name={isUSStock ? "股票每月價格 (Monthly Price USD)" : "股票每月價格 (Monthly Price)"}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="averageCost" 
                              stroke="#9333ea" 
                              strokeWidth={2} 
                              strokeDasharray="5 5"
                              dot={false}
                              name={isUSStock ? "平均買入價 (Avg Cost USD)" : "平均買入價 (Avg Cost)"}
                            />
                          </>
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Table Section - Scrollable with Sticky Header */}
                  <div id="report-table-body" className="flex-1 overflow-auto custom-scrollbar border-t border-gray-100 relative">
                    <div className="min-w-[1200px]">
                      {/* Table Header */}
                      <div className="sticky top-0 bg-gray-50 border-b border-gray-200 px-6 py-3 z-20">
                         <div className="grid gap-4 text-xs font-semibold text-gray-500 uppercase" style={{ gridTemplateColumns: '1.2fr 0.8fr 1fr 1fr 1fr 1fr 1.2fr 1fr 1fr 1.2fr 0.8fr 0.8fr 1.2fr' }}>
                            <div>日期</div>
                            <div>類型</div>
                            <div className="text-right">{isLiquidity ? '單位價值' : (isUSStock ? '股價 (USD)' : '股價')}</div>
                            <div className="text-right">平均成本</div>
                            <div className="text-right">現價差幅</div>
                            <div className="text-right">變動金額</div>
                            <div className="text-right">累積本金 (Net)</div>
                            <div className="text-right">{isLiquidity ? '變動結餘' : '變動股數'}</div>
                            <div className="text-right">{isLiquidity ? '累積結餘' : '累積股數'}</div>
                            <div className="text-right">{isLiquidity ? '結餘價值' : '股票價值'}</div>
                            <div className="text-right">{isLiquidity ? '利息' : '每股派息'}</div>
                            <div className="text-right">{isLiquidity ? '當月利息' : '當月派息'}</div>
                            <div className="text-right">總資產價值</div>
                         </div>
                      </div>

                      {/* Table Body */}
                      <div className="px-6 pb-24">
                         <div className="divide-y divide-gray-100">
                            {reportData.map((row, i) => (
                            <div key={i} className="grid gap-4 py-3 hover:bg-gray-50 transition-colors items-center text-sm" style={{ gridTemplateColumns: '1.2fr 0.8fr 1fr 1fr 1fr 1fr 1.2fr 1fr 1fr 1.2fr 0.8fr 0.8fr 1.2fr' }}>
                              <div className="font-medium text-gray-900">{row.displayDate}</div>
                              <div>
                                <span className={`px-2 py-1 rounded text-xs font-bold ${
                                  row.type === 'DCA' ? 'bg-blue-100 text-blue-700' :
                                  row.type === 'Buy' ? 'bg-emerald-100 text-emerald-700' :
                                  'bg-rose-100 text-rose-700'
                                }`}>
                                  {row.type}
                                </span>
                              </div>
                              <div className="text-right font-mono text-gray-600">
                                {row.type === 'Dividend' ? '-' : '$' + row.price.toFixed(2)}
                                {!isLiquidity && isUSStock && row.type !== 'Dividend' && <div className="text-[10px] text-gray-400">HKD ${(row.price * exchangeRate).toFixed(2)}</div>}
                              </div>
                              <div className="text-right font-mono text-gray-600">
                                ${row.averageCost.toFixed(2)}
                                {!isLiquidity && isUSStock && <div className="text-[10px] text-gray-400">HKD ${(row.averageCost * exchangeRate).toFixed(2)}</div>}
                              </div>
                              <div className={`text-right font-mono font-bold ${row.percentageDiff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {row.type === 'Dividend' ? '-' : (row.percentageDiff > 0 ? '+' : '') + row.percentageDiff.toFixed(2) + '%'}
                              </div>
                              <div className="text-right font-mono text-gray-600">
                                {row.type === 'Dividend' ? '-' : (row.type === 'Sell' ? '+' : '-') + '$' + row.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                {!isLiquidity && isUSStock && row.type !== 'Dividend' && <div className="text-[10px] text-gray-400">HKD ${row.amountInHKD?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>}
                              </div>
                              <div className="text-right font-mono text-gray-600">
                                ${row.cumulativePrincipal.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                {!isLiquidity && isUSStock && <div className="text-[10px] text-gray-400">HKD ${row.cumulativePrincipalInHKD?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>}
                              </div>
                              <div className="text-right font-mono text-gray-600">
                                {row.type === 'Dividend' ? '-' : (row.type === 'Sell' ? '-' : '+') + row.shares.toFixed(4)}
                              </div>
                              <div className="text-right font-mono text-gray-600">{row.cumulativeShares.toFixed(4)}</div>
                              <div className="text-right font-mono font-bold text-blue-600">
                                {row.type === 'Dividend' ? '-' : '$' + row.currentAssetValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                {!isLiquidity && isUSStock && row.type !== 'Dividend' && <div className="text-[10px] text-blue-400 font-normal">HKD ${row.currentAssetValueInHKD?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>}
                              </div>
                              <div className="text-right font-mono text-gray-600">
                                {row.dividendPerShare ? `$${row.dividendPerShare.toFixed(2)}` : '-'}
                                {!isLiquidity && isUSStock && row.dividendPerShare > 0 && <div className="text-[10px] text-gray-400">HKD ${(row.dividendPerShare * exchangeRate).toFixed(2)}</div>}
                              </div>
                              <div className="text-right font-mono text-emerald-600 font-bold">
                                {row.dividendReceived ? `+$${row.dividendReceived.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '-'}
                                {!isLiquidity && isUSStock && row.dividendReceived > 0 && <div className="text-[10px] text-emerald-400 font-normal">HKD ${row.dividendReceivedInHKD?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>}
                              </div>
                              <div className="text-right font-mono font-extrabold text-emerald-700">
                                {row.type === 'Dividend' ? '-' : '$' + row.totalAssetValueWithDividends.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                {!isLiquidity && isUSStock && row.type !== 'Dividend' && <div className="text-[10px] text-emerald-500 font-normal">HKD ${row.totalAssetValueWithDividendsInHKD?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>}
                              </div>
                            </div>
                          ))}
                       </div>
                    </div>
                  </div>
                  </div>
                </div>
              </div>
              
              <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3 shrink-0 z-20 relative">
                <button
                  onClick={handleExportPDF}
                  className="flex items-center gap-2 px-6 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200"
                >
                  <FileText className="w-4 h-4" /> 匯出 PDF
                </button>
                <button
                  onClick={handleExportJPEG}
                  className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
                >
                  <ImageIcon className="w-4 h-4" /> 匯出圖片 (JPEG)
                </button>
                <button
                  onClick={() => setShowReport(false)}
                  className="px-6 py-2 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-all"
                >
                  關閉
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showOverallReport && (
          <OverallReportModal 
            state={state} 
            categories={categories} 
            realTimePrices={realTimePrices} 
            onClose={() => setShowOverallReport(false)} 
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
