import React, { createContext, useContext, useState, useEffect } from "react";

export type FinancialRecord = {
  id: string; // "YYYY-MM"
  year: number;
  month: number;
  income: {
    salary: number;
    allowance: number;
    rental: number;
  };
  expense: {
    mortgage: number;
    household: number;
    utilities: number;
    parking: number;
    tuition: number;
    hobby: number;
    insurance: { id: string; name: string; amount: number }[];
    annuity: number;
    tax: number;
    personal: number;
    extra: { id: string; name: string; amount: number }[];
  };
};

export type AIPlanAllocationPeriod = {
  startYear: number;
  startMonth: number;
  endYear: number;
  endMonth: number;
  amount: number;
};

export type AIPlanAllocation = {
  category: string;
  percentage: number;
  periods: AIPlanAllocationPeriod[];
  expectedReturnRate: number;
  recommendations: string[];
  description: string;
  tickers?: string[];
  tickerPercentages?: Record<string, number>;
};

export type AIPlan = {
  targetAmount: number;
  years: number;
  startYear: number;
  startMonth: number;
  initialCapital: number;
  allocations: AIPlanAllocation[];
  planSummary: string;
  generatedAt: string; // "YYYY-MM"
};

export const calculateProjections = (plan: AIPlan, records: FinancialRecord[]) => {
  const monthlyProjections = [];
  
  // Initialize category totals
  const categoryTotals: Record<string, number> = {};
  plan.allocations.forEach(alloc => {
    categoryTotals[alloc.category] = 0;
  });
  
  // Put initial capital in Cash Reserve (or the first category if Cash Reserve doesn't exist)
  const cashCategory = plan.allocations.find(a => a.category === "現金儲備／定期")?.category || plan.allocations[0].category;
  categoryTotals[cashCategory] = plan.initialCapital;
  
  let currentTotal = plan.initialCapital;

  for (let m = 1; m <= plan.years * 12; m++) {
    const currentProjYear = plan.startYear + Math.floor((plan.startMonth - 1 + m - 1) / 12);
    const currentProjMonth = ((plan.startMonth - 1 + m - 1) % 12) + 1;
    
    let monthlyContribution = 0;
    const categoryContributions: Record<string, number> = {};
    
    plan.allocations.forEach(alloc => {
      let catContrib = 0;
      if (alloc.periods) {
        for (const period of alloc.periods) {
          const start = period.startYear * 12 + period.startMonth;
          const end = period.endYear * 12 + period.endMonth;
          const current = currentProjYear * 12 + currentProjMonth;
          if (current >= start && current <= end) {
            catContrib += period.amount;
            break;
          }
        }
      }
      categoryContributions[alloc.category] = catContrib;
      monthlyContribution += catContrib;
      
      const monthlyRate = (alloc.expectedReturnRate / 100) / 12;
      categoryTotals[alloc.category] = categoryTotals[alloc.category] * (1 + monthlyRate) + catContrib;
    });

    currentTotal = Object.values(categoryTotals).reduce((a, b) => a + b, 0);
    
    monthlyProjections.push({
      monthIndex: m,
      year: currentProjYear,
      month: currentProjMonth,
      expectedTotal: Math.round(currentTotal),
      expectedMonthlyContribution: monthlyContribution,
      categoryTotals: { ...categoryTotals },
      categoryContributions: { ...categoryContributions }
    });
  }
  
  return monthlyProjections;
};

export type ActualRecord = {
  id: string; // "YYYY-MM"
  actualTotal: number;
  actualAllocations: { category: string; amount: number; price?: number }[];
};

export type DCARecord = {
  id: string;
  ticker: string;
  category?: string;
  year: number;
  month: number;
  period?: string; // e.g. '上半月', '下半月'
  amount: number;
  price: number;
  shares: number;
  remainder?: number;
  dividendPerShare?: number;
};

export type TradeRecord = {
  id: string;
  ticker: string;
  category?: string;
  type: 'buy' | 'sell' | 'withdraw' | 'dividend';
  date: string; // YYYY-MM-DD
  price: number;
  shares: number;
  totalAmount: number;
};

export type AppState = {
  records: FinancialRecord[];
  aiPlan: AIPlan | null;
  actuals: ActualRecord[];
  dcaRecords: DCARecord[];
  tradeRecords: TradeRecord[];
  initialCashReserve: number;
  initialLiquidityReserve: number;
  realTimePrices: Record<string, number>;
};

type AppContextType = {
  state: AppState;
  addOrUpdateRecord: (record: FinancialRecord) => void;
  getRecordForMonth: (year: number, month: number) => FinancialRecord | null;
  getLatestRecordBefore: (
    year: number,
    month: number,
  ) => FinancialRecord | null;
  deleteRecord: (id: string) => void;
  setAIPlan: (plan: AIPlan) => void;
  addOrUpdateActual: (actual: ActualRecord) => void;
  getActualForMonth: (year: number, month: number) => ActualRecord | null;
  clearAllData: () => void;
  addOrUpdateDCARecord: (record: DCARecord) => void;
  deleteDCARecord: (id: string) => void;
  addTradeRecord: (record: TradeRecord) => void;
  deleteTradeRecord: (id: string) => void;
  importDCADataset: (dca: DCARecord[], trades: TradeRecord[], initialCash?: number, initialLiquidity?: number) => void;
  setInitialCashReserve: (amount: number) => void;
  setInitialLiquidityReserve: (amount: number) => void;
  setRealTimePrice: (category: string, price: number) => void;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

const defaultRecord: FinancialRecord = {
  id: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`,
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1,
  income: { salary: 0, allowance: 0, rental: 0 },
  expense: {
    mortgage: 0,
    household: 0,
    utilities: 0,
    parking: 0,
    tuition: 0,
    hobby: 0,
    insurance: [],
    annuity: 0,
    tax: 0,
    personal: 0,
    extra: [],
  },
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem("wealthApp");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Migration for new fields if they don't exist
        return {
          records: parsed.records || [defaultRecord],
          aiPlan: parsed.aiPlan || null,
          actuals: parsed.actuals || [],
          dcaRecords: parsed.dcaRecords || [],
          tradeRecords: parsed.tradeRecords || [],
          initialCashReserve: parsed.initialCashReserve || 0,
          initialLiquidityReserve: parsed.initialLiquidityReserve || 0,
          realTimePrices: parsed.realTimePrices || {},
        };
      } catch (e) {
        console.error("Failed to parse saved state", e);
      }
    }
    return { records: [defaultRecord], aiPlan: null, actuals: [], dcaRecords: [], tradeRecords: [], initialCashReserve: 0, initialLiquidityReserve: 0, realTimePrices: {} };
  });

  useEffect(() => {
    localStorage.setItem("wealthApp", JSON.stringify(state));
  }, [state]);

  const addOrUpdateRecord = (record: FinancialRecord) => {
    setState((prev) => {
      const existingIndex = prev.records.findIndex((r) => r.id === record.id);
      if (existingIndex >= 0) {
        const newRecords = [...prev.records];
        newRecords[existingIndex] = record;
        return { ...prev, records: newRecords };
      }
      // Keep records sorted by date
      const newRecords = [...prev.records, record].sort((a, b) =>
        a.id.localeCompare(b.id),
      );
      return { ...prev, records: newRecords };
    });
  };

  const deleteRecord = (id: string) => {
    setState((prev) => ({
      ...prev,
      records: prev.records.filter((r) => r.id !== id),
    }));
  };

  const getRecordForMonth = (year: number, month: number) => {
    const id = `${year}-${String(month).padStart(2, "0")}`;
    return state.records.find((r) => r.id === id) || null;
  };

  const getLatestRecordBefore = (year: number, month: number) => {
    const id = `${year}-${String(month).padStart(2, "0")}`;
    const pastRecords = state.records
      .filter((r) => r.id <= id)
      .sort((a, b) => b.id.localeCompare(a.id));
    return pastRecords.length > 0 ? pastRecords[0] : null;
  };

  const setAIPlan = (plan: AIPlan) => {
    setState((prev) => ({ ...prev, aiPlan: plan, initialCashReserve: plan.initialCapital }));
  };

  const addOrUpdateActual = (actual: ActualRecord) => {
    setState((prev) => {
      const existingIndex = prev.actuals.findIndex((a) => a.id === actual.id);
      if (existingIndex >= 0) {
        const newActuals = [...prev.actuals];
        newActuals[existingIndex] = actual;
        return { ...prev, actuals: newActuals };
      }
      return { ...prev, actuals: [...prev.actuals, actual] };
    });
  };

  const getActualForMonth = (year: number, month: number) => {
    const id = `${year}-${String(month).padStart(2, "0")}`;
    return state.actuals.find((a) => a.id === id) || null;
  };

  const addOrUpdateDCARecord = (record: DCARecord) => {
    setState((prev) => {
      const existingIndex = prev.dcaRecords.findIndex((r) => r.id === record.id);
      let newRecords;
      if (existingIndex >= 0) {
        newRecords = [...prev.dcaRecords];
        newRecords[existingIndex] = record;
      } else {
        newRecords = [...prev.dcaRecords, record];
      }
      // Sort by date (year, month)
      newRecords.sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
      });
      return { ...prev, dcaRecords: newRecords };
    });
  };

  const deleteDCARecord = (id: string) => {
    setState((prev) => ({
      ...prev,
      dcaRecords: prev.dcaRecords.filter((r) => r.id !== id),
    }));
  };

  const addTradeRecord = (record: TradeRecord) => {
    setState((prev) => {
      const newRecords = [...prev.tradeRecords, record].sort((a, b) => a.date.localeCompare(b.date));
      return { ...prev, tradeRecords: newRecords };
    });
  };

  const deleteTradeRecord = (id: string) => {
    setState((prev) => ({
      ...prev,
      tradeRecords: prev.tradeRecords.filter((r) => r.id !== id),
    }));
  };

  const importDCADataset = (dca: DCARecord[], trades: TradeRecord[], initialCash: number = 0, initialLiquidity: number = 0) => {
    setState((prev) => ({
      ...prev,
      dcaRecords: dca,
      tradeRecords: trades,
      initialCashReserve: initialCash,
      initialLiquidityReserve: initialLiquidity,
    }));
  };

  const setInitialCashReserve = (amount: number) => {
    setState((prev) => ({ ...prev, initialCashReserve: amount }));
  };

  const setInitialLiquidityReserve = (amount: number) => {
    setState((prev) => ({ ...prev, initialLiquidityReserve: amount }));
  };

  const setRealTimePrice = (category: string, price: number) => {
    setState((prev) => ({
      ...prev,
      realTimePrices: {
        ...prev.realTimePrices,
        [category]: price,
      },
    }));
  };

  const clearAllData = () => {
    localStorage.removeItem("wealthApp");
    window.location.reload();
  };

  return (
    <AppContext.Provider
      value={{
        state,
        addOrUpdateRecord,
        getRecordForMonth,
        getLatestRecordBefore,
        deleteRecord,
        setAIPlan,
        addOrUpdateActual,
        getActualForMonth,
        clearAllData,
        addOrUpdateDCARecord,
        deleteDCARecord,
        addTradeRecord,
        deleteTradeRecord,
        importDCADataset,
        setInitialCashReserve,
        setInitialLiquidityReserve,
        setRealTimePrice,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return context;
};
