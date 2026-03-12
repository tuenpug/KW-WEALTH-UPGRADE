import React, { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import * as htmlToImage from "html-to-image";
import jsPDF from "jspdf";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Dot,
} from "recharts";
import {
  Calculator,
  TrendingUp,
  Search,
  Calendar,
  DollarSign,
  Percent,
  ArrowRight,
  Library,
  Clock,
  Image as ImageIcon,
} from "lucide-react";

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

function InterestCalculator() {
  const [principal, setPrincipal] = useState<string>("");
  const [monthlyContribution, setMonthlyContribution] = useState<string>("");
  const [monthlyInterest, setMonthlyInterest] = useState<string>("");
  const [annualInterest, setAnnualInterest] = useState<string>("");
  const [annualRate, setAnnualRate] = useState<string>("");
  const [years, setYears] = useState<string>("");
  
  // Results
  const [totalReturn, setTotalReturn] = useState<string>("");
  const [totalValue, setTotalValue] = useState<string>("");
  const [totalInvested, setTotalInvested] = useState<string>("");
  const [chartData, setChartData] = useState<any[]>([]);
  const reportRef = useRef<HTMLDivElement>(null);

  const [lastEdited, setLastEdited] = useState<
    "monthly" | "annual" | "rate" | null
  >(null);

  // Calculate total return whenever relevant fields change
  useEffect(() => {
    const p = Number(principal);
    const r = Number(annualRate);
    const y = Number(years);
    const pmt = Number(monthlyContribution) || 0;

    if (p > 0 && r > 0 && y > 0) {
      // 1. Future Value of Principal (Annual Compounding)
      const fvPrincipal = p * Math.pow(1 + r / 100, y);

      // 2. Future Value of Monthly Contributions (Monthly Compounding)
      const i = Math.pow(1 + r / 100, 1 / 12) - 1;
      const n = y * 12;

      let fvContributions = 0;
      if (pmt > 0) {
        if (i > 0) {
           fvContributions = pmt * (Math.pow(1 + i, n) - 1) / i;
        } else {
           fvContributions = pmt * n;
        }
      }

      const calculatedTotalValue = fvPrincipal + fvContributions;
      const calculatedTotalInvested = p + (pmt * n);
      const ret = calculatedTotalValue - calculatedTotalInvested;
      
      setTotalValue(calculatedTotalValue.toFixed(2));
      setTotalInvested(calculatedTotalInvested.toFixed(2));
      setTotalReturn(ret.toFixed(2));

      // Generate Chart Data
      const data = [];
      for (let year = 0; year <= y; year++) {
        const currentP = p + (pmt * 12 * year);
        const fvP = p * Math.pow(1 + r / 100, year);
        
        const currentN = year * 12;
        let fvC = 0;
        if (pmt > 0) {
          if (i > 0) {
            fvC = pmt * (Math.pow(1 + i, currentN) - 1) / i;
          } else {
            fvC = pmt * currentN;
          }
        }
        
        data.push({
          year: `第 ${year} 年`,
          principal: currentP,
          totalValue: fvP + fvC,
        });
      }
      setChartData(data);
    } else {
      setTotalValue("");
      setTotalInvested("");
      setTotalReturn("");
      setChartData([]);
    }
  }, [principal, annualRate, years, monthlyContribution]);

  const handlePrincipalChange = (val: string) => {
    setPrincipal(val);
    const p = Number(val);
    if (!p) return;

    if (lastEdited === "rate" && annualRate) {
      const r = Number(annualRate);
      const aInt = p * (r / 100);
      setAnnualInterest(aInt.toFixed(2));
      setMonthlyInterest((aInt / 12).toFixed(2));
    } else if (lastEdited === "annual" && annualInterest) {
      const aInt = Number(annualInterest);
      setAnnualRate(((aInt / p) * 100).toFixed(2));
      setMonthlyInterest((aInt / 12).toFixed(2));
    } else if (lastEdited === "monthly" && monthlyInterest) {
      const mInt = Number(monthlyInterest);
      const aInt = mInt * 12;
      setAnnualInterest(aInt.toFixed(2));
      setAnnualRate(((aInt / p) * 100).toFixed(2));
    }
  };

  const handleMonthlyChange = (val: string) => {
    setMonthlyInterest(val);
    setLastEdited("monthly");
    const mInt = Number(val);
    const p = Number(principal);
    if (!isNaN(mInt)) {
      const aInt = mInt * 12;
      setAnnualInterest(aInt.toFixed(2));
      if (p > 0) {
        setAnnualRate(((aInt / p) * 100).toFixed(2));
      }
    }
  };

  const handleAnnualChange = (val: string) => {
    setAnnualInterest(val);
    setLastEdited("annual");
    const aInt = Number(val);
    const p = Number(principal);
    if (!isNaN(aInt)) {
      setMonthlyInterest((aInt / 12).toFixed(2));
      if (p > 0) {
        setAnnualRate(((aInt / p) * 100).toFixed(2));
      }
    }
  };

  const handleRateChange = (val: string) => {
    setAnnualRate(val);
    setLastEdited("rate");
    const r = Number(val);
    const p = Number(principal);
    if (!isNaN(r) && p > 0) {
      const aInt = p * (r / 100);
      setAnnualInterest(aInt.toFixed(2));
      setMonthlyInterest((aInt / 12).toFixed(2));
    }
  };

  const handleExportReport = async () => {
    if (!reportRef.current) return;
    try {
      const dataUrl = await htmlToImage.toPng(reportRef.current, { quality: 0.95, backgroundColor: '#ffffff' });
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (reportRef.current.offsetHeight * pdfWidth) / reportRef.current.offsetWidth;
      pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save('interest-report.pdf');
    } catch (err) {
      console.error("Failed to export PDF", err);
      alert("匯出 PDF 失敗 (Failed to export PDF)");
    }
  };

  return (
    <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-lg border border-white/20 relative overflow-hidden group hover:shadow-xl transition-all duration-300">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      
      <div className="flex items-center justify-between mb-8 relative z-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-200">
            <Calculator className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">年厘率計算器</h2>
            <p className="text-sm text-gray-500 mt-1 font-medium">
              輸入本金及任意一項利息資料，自動計算其餘數值 (可選填每月定投)
            </p>
          </div>
        </div>
        {chartData.length > 0 && (
          <button
            onClick={handleExportReport}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-lg shadow-emerald-200 transition-all hover:-translate-y-0.5"
          >
            <ArrowRight className="w-4 h-4" /> 生成報表
          </button>
        )}
      </div>

      <div ref={reportRef} className="bg-white p-6 rounded-2xl">
        <div className="mb-6 text-center border-b border-gray-100 pb-4">
          <h2 className="text-2xl font-bold text-gray-900">定期存款及資產增值報表</h2>
          <p className="text-sm text-gray-500 mt-1">生成日期: {new Date().toLocaleDateString()}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10 mb-8">
        <div className="space-y-6">
          <div className="group/input">
            <label className="block text-sm font-semibold text-gray-700 mb-2 ml-1">
              本金 (Principal)
            </label>
            <div className="relative transform transition-all duration-200 group-focus-within/input:-translate-y-1">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <DollarSign className="h-5 w-5 text-emerald-500" />
              </div>
              <input
                type="number"
                value={principal}
                onChange={(e) => handlePrincipalChange(e.target.value)}
                className="block w-full pl-11 pr-4 py-3.5 bg-gray-50/50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all text-gray-900 font-medium placeholder:text-gray-400 shadow-sm"
                placeholder="例如: 100000"
              />
            </div>
          </div>

          <div className="group/input">
            <label className="block text-sm font-semibold text-gray-700 mb-2 ml-1">
              每月定投金額 (Monthly Contribution)
            </label>
            <div className="relative transform transition-all duration-200 group-focus-within/input:-translate-y-1">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <DollarSign className="h-5 w-5 text-emerald-500" />
              </div>
              <input
                type="number"
                value={monthlyContribution}
                onChange={(e) => setMonthlyContribution(e.target.value)}
                className="block w-full pl-11 pr-4 py-3.5 bg-gray-50/50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all text-gray-900 font-medium placeholder:text-gray-400 shadow-sm"
                placeholder="例如: 1000 (預設 0)"
              />
            </div>
          </div>

          <div className="group/input">
            <label className="block text-sm font-semibold text-gray-700 mb-2 ml-1">
              年利率 (Annual Rate)
            </label>
            <div className="relative transform transition-all duration-200 group-focus-within/input:-translate-y-1">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Percent className="h-5 w-5 text-emerald-500" />
              </div>
              <input
                type="number"
                value={annualRate}
                onChange={(e) => handleRateChange(e.target.value)}
                className="block w-full pl-11 pr-4 py-3.5 bg-gray-50/50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all text-gray-900 font-medium placeholder:text-gray-400 shadow-sm"
                placeholder="例如: 5"
              />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="group/input">
            <label className="block text-sm font-semibold text-gray-700 mb-2 ml-1">
              年期 (Years)
            </label>
            <div className="relative transform transition-all duration-200 group-focus-within/input:-translate-y-1">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Clock className="h-5 w-5 text-emerald-500" />
              </div>
              <input
                type="number"
                value={years}
                onChange={(e) => setYears(e.target.value)}
                className="block w-full pl-11 pr-4 py-3.5 bg-gray-50/50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all text-gray-900 font-medium placeholder:text-gray-400 shadow-sm"
                placeholder="例如: 5"
              />
            </div>
          </div>

          <div className="group/input">
            <label className="block text-sm font-semibold text-gray-700 mb-2 ml-1">
              每月利息 (Monthly Interest)
            </label>
            <div className="relative transform transition-all duration-200 group-focus-within/input:-translate-y-1">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <DollarSign className="h-5 w-5 text-emerald-500" />
              </div>
              <input
                type="number"
                value={monthlyInterest}
                onChange={(e) => handleMonthlyChange(e.target.value)}
                className="block w-full pl-11 pr-4 py-3.5 bg-gray-50/50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all text-gray-900 font-medium placeholder:text-gray-400 shadow-sm"
                placeholder="自動計算"
              />
            </div>
          </div>

          <div className="group/input">
            <label className="block text-sm font-semibold text-gray-700 mb-2 ml-1">
              每年總利息 (Annual Interest)
            </label>
            <div className="relative transform transition-all duration-200 group-focus-within/input:-translate-y-1">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <DollarSign className="h-5 w-5 text-emerald-500" />
              </div>
              <input
                type="number"
                value={annualInterest}
                onChange={(e) => handleAnnualChange(e.target.value)}
                className="block w-full pl-11 pr-4 py-3.5 bg-gray-50/50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all text-gray-900 font-medium placeholder:text-gray-400 shadow-sm"
                placeholder="自動計算"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-emerald-50/80 rounded-3xl p-6 border border-emerald-100 relative z-10">
         <h3 className="text-lg font-bold text-emerald-800 mb-4 flex items-center gap-2">
           <TrendingUp className="w-5 h-5" /> 計算結果
         </h3>
         <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white/60 p-4 rounded-2xl border border-emerald-100/50">
              <p className="text-sm font-bold text-emerald-600/70 mb-1">總投入本金</p>
              <p className="text-2xl font-extrabold text-emerald-900">
                {totalInvested ? `$${Number(totalInvested).toLocaleString()}` : '-'}
              </p>
            </div>
            <div className="bg-white/60 p-4 rounded-2xl border border-emerald-100/50">
              <p className="text-sm font-bold text-emerald-600/70 mb-1">期末總資產 (Final Value)</p>
              <p className="text-2xl font-extrabold text-emerald-700">
                {totalValue ? `$${Number(totalValue).toLocaleString()}` : '-'}
              </p>
            </div>
            <div className="bg-white/60 p-4 rounded-2xl border border-emerald-100/50">
              <p className="text-sm font-bold text-emerald-600/70 mb-1">總利息收益 (Total Profit)</p>
              <p className="text-2xl font-extrabold text-emerald-600">
                {totalReturn ? `+$${Number(totalReturn).toLocaleString()}` : '-'}
              </p>
            </div>
         </div>

         {chartData.length > 0 && (
           <div className="space-y-6">
             <div className="bg-white/80 p-6 rounded-2xl border border-emerald-100/50 h-[400px]">
               <ResponsiveContainer width="100%" height="100%">
                 <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 10 }}>
                   <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                   <XAxis dataKey="year" stroke="#6b7280" fontSize={12} tickMargin={10} />
                   <YAxis 
                     stroke="#6b7280" 
                     fontSize={12} 
                     tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                   />
                   <Tooltip 
                     formatter={(value: number) => [`$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, '']}
                     contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                   />
                   <Legend />
                   <Line 
                     type="monotone" 
                     dataKey="totalValue" 
                     name="總資產" 
                     stroke="#10b981" 
                     strokeWidth={3} 
                     dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} 
                     activeDot={{ r: 6 }} 
                   />
                   <Line 
                     type="monotone" 
                     dataKey="principal" 
                     name="總投入本金" 
                     stroke="#94a3b8" 
                     strokeWidth={3} 
                     dot={false}
                   />
                 </LineChart>
               </ResponsiveContainer>
             </div>

             <div className="bg-white/80 rounded-2xl border border-emerald-100/50 overflow-hidden">
               <div className="overflow-x-auto">
                 <table className="w-full text-sm text-left">
                   <thead className="bg-emerald-50/50 text-emerald-800 font-semibold border-b border-emerald-100">
                     <tr>
                       <th className="px-6 py-4">年份</th>
                       <th className="px-6 py-4 text-right">累積投入本金</th>
                       <th className="px-6 py-4 text-right">累積利息</th>
                       <th className="px-6 py-4 text-right">期末總資產</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-emerald-50">
                     {chartData.map((row, idx) => (
                       <tr key={idx} className="hover:bg-emerald-50/30 transition-colors">
                         <td className="px-6 py-4 font-medium text-gray-900">{row.year}</td>
                         <td className="px-6 py-4 text-right text-gray-600">${row.principal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                         <td className="px-6 py-4 text-right text-emerald-600 font-medium">+${(row.totalValue - row.principal).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                         <td className="px-6 py-4 text-right font-bold text-gray-900">${row.totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             </div>
           </div>
         )}
      </div>
      </div>
    </div>
  );
}

type SimulationResult = {
  year: number;
  month: number;
  actualDate: string;
  price: number;
  monthlyPrincipal: number;
  totalPrincipal: number;
  sharesBought: number;
  totalShares: number;
  totalValue: number;
  averageCost: number;
  percentageDiff: number;
  dividendPerShare: number;
  dividendReceived: number;
  accumulatedDividends: number;
  totalAssetValueWithDividends: number;
};

function DCASimulator() {
  const [ticker, setTicker] = useState("QQQ");
  const [startYear, setStartYear] = useState(new Date().getFullYear() - 5);
  const [startMonth, setStartMonth] = useState(1);
  const [frequency, setFrequency] = useState<"semi-monthly" | "monthly" | "bi-monthly">("monthly");
  const [timingStrategy, setTimingStrategy] = useState<"start_of_month" | "best_timing" | "worst_timing">("start_of_month");
  const [monthlyAmount, setMonthlyAmount] = useState(1000);
  const [durationYears, setDurationYears] = useState(5);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<SimulationResult[]>([]);
  const [simulatedTicker, setSimulatedTicker] = useState("");
  const [simulatedStockName, setSimulatedStockName] = useState("");
  const resultsRef = useRef<HTMLDivElement>(null);

  const handleExportPDF = async () => {
    if (!resultsRef.current) return;
    try {
      // Small delay to ensure rendering is stable
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const topSection = document.getElementById('sim-top-section');
      const wrapper = document.getElementById('sim-results-wrapper');
      const innerWrapper = wrapper?.querySelector('.overflow-auto') as HTMLElement;
      
      let originalOverflow = '';
      let originalHeight = '';
      let originalMaxHeight = '';
      let innerOriginalOverflow = '';
      
      if (wrapper) {
        originalOverflow = wrapper.style.overflow;
        originalHeight = wrapper.style.height;
        originalMaxHeight = wrapper.style.maxHeight;
        
        wrapper.style.overflow = 'visible';
        wrapper.style.height = 'auto';
        wrapper.style.maxHeight = 'none';
      }
      
      if (innerWrapper) {
        innerOriginalOverflow = innerWrapper.style.overflow;
        innerWrapper.style.overflow = 'visible';
      }

      const commonOptions = {
        quality: 1.0,
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        filter: (node: HTMLElement) => {
          return node.getAttribute ? node.getAttribute('data-html2canvas-ignore') !== 'true' : true;
        }
      };

      const topImgData = topSection ? await htmlToImage.toJpeg(topSection, commonOptions) : null;
      const tableImgData = wrapper ? await htmlToImage.toJpeg(wrapper, commonOptions) : null;
      
      if (wrapper) {
        wrapper.style.overflow = originalOverflow;
        wrapper.style.height = originalHeight;
        wrapper.style.maxHeight = originalMaxHeight;
      }
      
      if (innerWrapper) {
        innerWrapper.style.overflow = innerOriginalOverflow;
      }
      
      const pdfWidth = 297; // A4 landscape width in mm
      let pdf: jsPDF | null = null;

      if (topImgData) {
        const topImg = new Image();
        topImg.src = topImgData;
        await new Promise(resolve => { topImg.onload = resolve; });
        const topPdfHeight = (topImg.height * pdfWidth) / topImg.width;
        
        pdf = new jsPDF({
          orientation: 'l',
          unit: 'mm',
          format: [pdfWidth, topPdfHeight > 0 ? topPdfHeight : 210]
        });
        pdf.addImage(topImgData, 'JPEG', 0, 0, pdfWidth, topPdfHeight);
      }

      if (tableImgData) {
        const tableImg = new Image();
        tableImg.src = tableImgData;
        await new Promise(resolve => { tableImg.onload = resolve; });
        const tablePdfHeight = (tableImg.height * pdfWidth) / tableImg.width;
        
        if (pdf) {
          pdf.addPage([pdfWidth, tablePdfHeight > 0 ? tablePdfHeight : 210], 'l');
          pdf.setPage(2);
          pdf.addImage(tableImgData, 'JPEG', 0, 0, pdfWidth, tablePdfHeight);
        } else {
          pdf = new jsPDF({
            orientation: 'l',
            unit: 'mm',
            format: [pdfWidth, tablePdfHeight > 0 ? tablePdfHeight : 210]
          });
          pdf.addImage(tableImgData, 'JPEG', 0, 0, pdfWidth, tablePdfHeight);
        }
      }
      
      if (pdf) {
        pdf.save(`dca_simulation_${ticker}_${new Date().toISOString().split('T')[0]}.pdf`);
      }
      
    } catch (err) {
      console.error("Failed to export PDF", err);
      alert("匯出 PDF 失敗 (Failed to export PDF)");
    }
  };

  const handleSimulate = async () => {
    if (!ticker) return;
    setLoading(true);
    setError("");
    setResults([]);

    const now = new Date();

    try {
      let symbol = ticker.toUpperCase().trim();
      // Check if it's a HK stock (3-5 digits)
      if (/^\d{3,5}$/.test(symbol)) {
        symbol = symbol.padStart(4, '0') + ".HK";
      }

      // Calculate required date range
      // Start from a bit before the requested start year to ensure we have data
      const startDate = new Date(startYear, startMonth - 1, 1);
      const startTimestamp = Math.floor(startDate.getTime() / 1000);
      const endTimestamp = Math.floor(Date.now() / 1000);

      // Use period1 and period2 for more precise data fetching
      // Add a buffer to startTimestamp (e.g., 1 week before) to be safe
      const bufferSeconds = 7 * 24 * 60 * 60;
      const queryStart = startTimestamp - bufferSeconds;

      const url = `/api/stock/${symbol}?period1=${queryStart}&period2=${endTimestamp}`;
      
      let data = null;

      try {
        const res = await fetch(url);
        if (!res.ok) {
          let errorMsg = `無法獲取數據: ${res.statusText}`;
          try {
            const errorData = await res.json();
            if (errorData.error) {
              errorMsg = errorData.error;
            }
          } catch (jsonError) {
            // Ignore JSON parsing error
          }
          throw new Error(errorMsg);
        }
        const json = await res.json();
        if (json.chart && json.chart.result) {
          data = json;
        } else {
          throw new Error("伺服器返回無效數據");
        }
      } catch (e: any) {
        if (e.message && e.message.includes("無法獲取該股票數據")) {
          console.warn(`Fetch warning: ${e.message}`);
        } else {
          console.error("Fetch error:", e);
        }
        throw new Error(e.message || "無法獲取該股票數據，請檢查代號是否正確，或伺服器暫時無法連線。");
      }

      const result = data?.chart?.result?.[0];
      if (!result || !result.timestamp || !result.indicators.quote[0].close) {
        throw new Error("無法獲取該股票數據，請檢查代號是否正確，或伺服器暫時無法連線。");
      }

      const fetchedStockName = result.meta?.stockName || result.meta?.shortName || result.meta?.longName || symbol;

      const timestamps = result.timestamp;
      const closes = result.indicators.quote[0].close;
      const events = result.events || {};
      const dividends = events.dividends || {};

      // Create a map of date string (YYYY-MM-DD) to dividend amount
      const dividendMap = new Map<string, number>();
      // dividends can be an array (from yahoo-finance2) or an object (from raw Yahoo API)
      const dividendList = Array.isArray(dividends) ? dividends : Object.values(dividends);
      
      dividendList.forEach((div: any) => {
        if (!div.date) return;
        let date;
        // Check if date is a timestamp (number) or ISO string
        if (typeof div.date === 'number') {
           date = new Date(div.date * 1000);
        } else {
           date = new Date(div.date);
        }
        
        if (isNaN(date.getTime())) return;
        const dateStr = date.toISOString().split('T')[0];
        dividendMap.set(dateStr, div.amount);
      });

      const dailyData = timestamps
        .map((ts: number, i: number) => {
           if (typeof ts !== 'number') return null;
           const date = new Date(ts * 1000);
           if (isNaN(date.getTime())) return null;
           const dateStr = date.toISOString().split('T')[0];
           return {
            date: date,
            dateStr: dateStr,
            close: closes[i],
            dividend: dividendMap.get(dateStr) || 0
          };
        })
        .filter((d: any) => d && d.close !== null);

      // 1. Generate Target Periods
      const periods: { start: Date, end: Date, targetDate: Date }[] = [];
      let m = 0;
      const totalMonths = durationYears * 12;
      let currentYear = startYear;
      let currentMonth = startMonth;
      
      while (m < totalMonths) {
        if (frequency === 'semi-monthly') {
          periods.push({
            start: new Date(currentYear, currentMonth - 1, 1),
            end: new Date(currentYear, currentMonth - 1, 15, 23, 59, 59),
            targetDate: new Date(currentYear, currentMonth - 1, 1, 23, 59, 59)
          });
          periods.push({
            start: new Date(currentYear, currentMonth - 1, 16),
            end: new Date(currentYear, currentMonth, 0, 23, 59, 59),
            targetDate: new Date(currentYear, currentMonth - 1, 15, 23, 59, 59)
          });
          m += 1;
          currentMonth += 1;
        } else if (frequency === 'monthly') {
          periods.push({
            start: new Date(currentYear, currentMonth - 1, 1),
            end: new Date(currentYear, currentMonth, 0, 23, 59, 59),
            targetDate: new Date(currentYear, currentMonth - 1, 1, 23, 59, 59)
          });
          m += 1;
          currentMonth += 1;
        } else if (frequency === 'bi-monthly') {
          periods.push({
            start: new Date(currentYear, currentMonth - 1, 1),
            end: new Date(currentYear, currentMonth + 1, 0, 23, 59, 59),
            targetDate: new Date(currentYear, currentMonth - 1, 1, 23, 59, 59)
          });
          m += 2;
          currentMonth += 2;
        }
        
        while (currentMonth > 12) {
          currentYear++;
          currentMonth -= 12;
        }
      }

      // 2. Find Actual Purchase Dates and Prices
      const purchases: { targetDate: Date, actualDate: Date, actualDateStr: string, price: number, shares: number, targetPrice: number }[] = [];
      
      for (const period of periods) {
        if (period.start > now) break;
        
        let bestDay = null;
        let targetDay = null;

        // Find the target day (1st of month or 15th)
        for (let i = dailyData.length - 1; i >= 0; i--) {
          if (dailyData[i].date <= period.targetDate) {
            targetDay = dailyData[i];
            break;
          }
        }
        
        if (timingStrategy === 'start_of_month') {
          bestDay = targetDay;
        } else {
          // Find all trading days in the period
          const daysInPeriod = dailyData.filter((d: any) => d.date >= period.start && d.date <= period.end && d.date <= now);
          
          if (daysInPeriod.length > 0) {
            if (timingStrategy === 'best_timing') {
              // Lowest price
              bestDay = daysInPeriod.reduce((min: any, d: any) => d.close < min.close ? d : min, daysInPeriod[0]);
            } else if (timingStrategy === 'worst_timing') {
              // Highest price
              bestDay = daysInPeriod.reduce((max: any, d: any) => d.close > max.close ? d : max, daysInPeriod[0]);
            }
          } else {
            // Fallback if no days in period (e.g. future or missing data), just use the last available day before period.end
            for (let i = dailyData.length - 1; i >= 0; i--) {
              if (dailyData[i].date <= period.end) {
                bestDay = dailyData[i];
                break;
              }
            }
          }
        }

        if (bestDay && targetDay) {
          purchases.push({
            targetDate: period.targetDate,
            actualDate: bestDay.date,
            actualDateStr: bestDay.dateStr,
            price: bestDay.close,
            shares: monthlyAmount / bestDay.close,
            targetPrice: targetDay.close
          });
        }
      }

      let totalPrincipal = 0;
      let totalShares = 0;
      let accumulatedDividends = 0;
      const simResults: SimulationResult[] = [];
      
      const simEvents: { date: Date, type: 'purchase' | 'dividend', data: any }[] = [];
      
      for (const p of purchases) {
        simEvents.push({ date: p.actualDate, type: 'purchase', data: p });
      }
      
      dividendMap.forEach((amount, dateStr) => {
        const divDate = new Date(dateStr);
        if (purchases.length > 0 && divDate >= purchases[0].actualDate && divDate <= now) {
          simEvents.push({ date: divDate, type: 'dividend', data: { amount } });
        }
      });
      
      simEvents.sort((a, b) => {
        const timeDiff = a.date.getTime() - b.date.getTime();
        if (timeDiff !== 0) return timeDiff;
        if (a.type === 'dividend' && b.type === 'purchase') return -1;
        if (a.type === 'purchase' && b.type === 'dividend') return 1;
        return 0;
      });

      let periodDividendPerShare = 0;
      let periodDividendReceived = 0;
      
      for (const ev of simEvents) {
        if (ev.type === 'dividend') {
          const amount = ev.data.amount;
          periodDividendPerShare += amount;
          const received = totalShares * amount;
          periodDividendReceived += received;
          accumulatedDividends += received;
        } else if (ev.type === 'purchase') {
          const p = ev.data;
          totalPrincipal += monthlyAmount;
          totalShares += p.shares;
          
          const valuationPrice = timingStrategy === 'start_of_month' ? p.price : p.targetPrice;
          const totalValue = totalShares * valuationPrice;
          const averageCost = totalPrincipal / totalShares;
          const percentageDiff = ((valuationPrice - averageCost) / averageCost) * 100;
          
          simResults.push({
            year: p.targetDate.getFullYear(),
            month: p.targetDate.getMonth() + 1,
            actualDate: p.actualDateStr,
            price: p.price,
            monthlyPrincipal: monthlyAmount,
            totalPrincipal,
            sharesBought: p.shares,
            totalShares,
            totalValue,
            averageCost,
            percentageDiff,
            dividendPerShare: periodDividendPerShare,
            dividendReceived: periodDividendReceived,
            accumulatedDividends,
            totalAssetValueWithDividends: totalValue + accumulatedDividends
          });
          
          periodDividendPerShare = 0;
          periodDividendReceived = 0;
        }
      }

      if (simResults.length > 0) {
        // Update the last result with any dividends that occurred after the last purchase
        const lastResult = simResults[simResults.length - 1];
        lastResult.accumulatedDividends = accumulatedDividends;
        lastResult.totalAssetValueWithDividends = lastResult.totalValue + accumulatedDividends;
      }

      if (simResults.length === 0) {
        throw new Error("所選時間範圍內沒有足夠的歷史數據。");
      }

      setResults(simResults);
      setSimulatedTicker(ticker.toUpperCase());
      setSimulatedStockName(fetchedStockName);
    } catch (err: any) {
      setError(err.message || "發生未知錯誤");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-lg border border-white/20 mt-8 relative overflow-hidden group hover:shadow-xl transition-all duration-300">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      
      <div className="flex items-center gap-4 mb-8 relative z-10">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-200">
          <TrendingUp className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">定投回報趨勢評估</h2>
          <p className="text-sm text-gray-500 mt-1 font-medium">
            以過往真實市場數據，模擬每月定投股票的回報效益 (支持港股，如 0700)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6 mb-8 relative z-10">
        <div className="group/input">
          <label className="block text-sm font-semibold text-gray-700 mb-2 ml-1">
            股票代號
          </label>
          <div className="relative transform transition-all duration-200 group-focus-within/input:-translate-y-1">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-blue-500" />
            </div>
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              className="block w-full pl-11 pr-4 py-3.5 bg-gray-50/50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all text-gray-900 font-medium placeholder:text-gray-400 uppercase shadow-sm"
              placeholder="例如: QQQ, 0700"
            />
          </div>
        </div>

        <div className="group/input">
          <label className="block text-sm font-semibold text-gray-700 mb-2 ml-1">
            起初年份
          </label>
          <div className="relative transform transition-all duration-200 group-focus-within/input:-translate-y-1">
            <input
              type="number"
              value={startYear}
              onChange={(e) => setStartYear(Number(e.target.value))}
              className="block w-full px-4 py-3.5 bg-gray-50/50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all text-gray-900 font-medium shadow-sm"
            />
          </div>
        </div>

        <div className="group/input">
          <label className="block text-sm font-semibold text-gray-700 mb-2 ml-1">
            起初月份
          </label>
          <div className="relative transform transition-all duration-200 group-focus-within/input:-translate-y-1">
            <select
              value={startMonth}
              onChange={(e) => setStartMonth(Number(e.target.value))}
              className="block w-full px-4 py-3.5 bg-gray-50/50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all text-gray-900 font-medium appearance-none shadow-sm"
            >
              {[...Array(12)].map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}月
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-gray-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </div>
        </div>

        <div className="group/input">
          <label className="block text-sm font-semibold text-gray-700 mb-2 ml-1">
            定投頻率
          </label>
          <div className="relative transform transition-all duration-200 group-focus-within/input:-translate-y-1">
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as any)}
              className="block w-full px-4 py-3.5 bg-gray-50/50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all text-gray-900 font-medium appearance-none shadow-sm"
            >
              <option value="semi-monthly">每半個月</option>
              <option value="monthly">每一個月</option>
              <option value="bi-monthly">每兩個月</option>
            </select>
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-gray-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </div>
        </div>

        <div className="group/input">
          <label className="block text-sm font-semibold text-gray-700 mb-2 ml-1">
            定投時機
          </label>
          <div className="relative transform transition-all duration-200 group-focus-within/input:-translate-y-1">
            <select
              value={timingStrategy}
              onChange={(e) => setTimingStrategy(e.target.value as any)}
              className="block w-full px-4 py-3.5 bg-gray-50/50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all text-gray-900 font-medium appearance-none shadow-sm"
            >
              <option value="start_of_month">月頭定投</option>
              <option value="best_timing">最佳時機</option>
              <option value="worst_timing">最差時機</option>
            </select>
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-gray-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </div>
        </div>

        <div className="group/input">
          <label className="block text-sm font-semibold text-gray-700 mb-2 ml-1">
            每次定投金額
          </label>
          <div className="relative transform transition-all duration-200 group-focus-within/input:-translate-y-1">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <DollarSign className="h-5 w-5 text-blue-500" />
            </div>
            <input
              type="number"
              value={monthlyAmount}
              onChange={(e) => setMonthlyAmount(Number(e.target.value))}
              className="block w-full pl-11 pr-4 py-3.5 bg-gray-50/50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all text-gray-900 font-medium shadow-sm"
            />
          </div>
        </div>

        <div className="group/input">
          <label className="block text-sm font-semibold text-gray-700 mb-2 ml-1">
            增值年期 (年)
          </label>
          <div className="relative transform transition-all duration-200 group-focus-within/input:-translate-y-1">
             <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
            <input
              type="number"
              value={durationYears}
              onChange={(e) => setDurationYears(Number(e.target.value))}
              className="block w-full pl-11 pr-4 py-3.5 bg-gray-50/50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all text-gray-900 font-medium shadow-sm"
            />
          </div>
        </div>
      </div>

      <button
        onClick={handleSimulate}
        disabled={loading}
        className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-bold text-lg shadow-lg shadow-blue-200 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
      >
        {loading ? (
          <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <>
            開始模擬 <ArrowRight className="w-5 h-5" />
          </>
        )}
      </button>

      {error && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl text-sm flex items-center gap-3 shadow-sm"
        >
          <div className="w-2 h-2 rounded-full bg-rose-500" />
          {error}
        </motion.div>
      )}

      {results.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-10"
        >
          <div ref={resultsRef} className="bg-white/50 backdrop-blur-sm p-4 rounded-3xl" style={{ backgroundColor: '#ffffff', color: '#111827' }}>
            <div id="sim-top-section">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-600" /> {simulatedStockName ? `${simulatedStockName} (${simulatedTicker})` : simulatedTicker} 模擬結果分析
                </h3>
                <button
                  onClick={handleExportPDF}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 text-sm"
                  data-html2canvas-ignore="true"
                >
                  <ImageIcon className="w-4 h-4" /> 匯出結果 (PDF)
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-gray-50/80 p-5 rounded-2xl border border-gray-100 hover:bg-white hover:shadow-md transition-all shadow-sm">
                  <p className="text-sm text-gray-500 mb-1 font-medium">總投入本金</p>
                  <p className="text-2xl font-bold text-gray-900 tracking-tight">
                    ${results[results.length - 1].totalPrincipal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div className="bg-blue-50/80 p-5 rounded-2xl border border-blue-100 hover:bg-blue-50 hover:shadow-md transition-all shadow-sm">
                  <p className="text-sm text-blue-600 mb-1 font-medium">總股票價值</p>
                  <p className="text-2xl font-bold text-blue-700 tracking-tight">
                    ${results[results.length - 1].totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div className="bg-yellow-50/80 p-5 rounded-2xl border border-yellow-100 hover:bg-yellow-50 hover:shadow-md transition-all shadow-sm">
                  <p className="text-sm text-yellow-600 mb-1 font-medium">總收取利息</p>
                  <p className="text-2xl font-bold text-yellow-700 tracking-tight">
                    ${results[results.length - 1].accumulatedDividends.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div className="bg-indigo-50/80 p-5 rounded-2xl border border-indigo-100 hover:bg-indigo-50 hover:shadow-md transition-all shadow-sm">
                  <p className="text-sm text-indigo-600 mb-1 font-medium">總收益</p>
                  <p className="text-2xl font-bold text-indigo-700 tracking-tight">
                    ${results[results.length - 1].totalAssetValueWithDividends.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div className="bg-emerald-50/80 p-5 rounded-2xl border border-emerald-100 hover:bg-emerald-50 hover:shadow-md transition-all shadow-sm">
                  <p className="text-sm text-emerald-600 mb-1 font-medium">總回報率 (含息)</p>
                  <p className="text-2xl font-bold text-emerald-700 tracking-tight">
                    {(((results[results.length - 1].totalAssetValueWithDividends / results[results.length - 1].totalPrincipal) - 1) * 100).toFixed(2)}%
                  </p>
                </div>
                <div className="bg-purple-50/80 p-5 rounded-2xl border border-purple-100 hover:bg-purple-50 hover:shadow-md transition-all shadow-sm">
                  <p className="text-sm text-purple-600 mb-1 font-medium">總持股數</p>
                  <p className="text-2xl font-bold text-purple-700 tracking-tight">
                    {results[results.length - 1].totalShares.toFixed(4)} 股
                  </p>
                </div>
              </div>

              <div className="h-64 mb-8 w-full">
                <h4 className="text-sm font-semibold text-gray-500 mb-2">股價 vs 平均成本 (Stock Price vs Avg Cost)</h4>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={results} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="actualDate" 
                      tickFormatter={(dateStr) => {
                         const date = new Date(dateStr);
                         return `${date.getFullYear()}-${date.getMonth() + 1}`;
                      }}
                      tick={{ fontSize: 10, fill: '#6b7280' }} 
                      axisLine={false} 
                      tickLine={false} 
                      interval="preserveStartEnd"
                      minTickGap={30}
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
                      labelFormatter={(label) => label}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <Line 
                      type="monotone" 
                      dataKey="price" 
                      stroke="#8884d8" 
                      strokeWidth={2} 
                      dot={(props) => <CustomDot {...props} dataLength={results.length} />}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                      name="股價 (Price)"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="averageCost" 
                      stroke="#a855f7" 
                      strokeWidth={2} 
                      strokeDasharray="5 5"
                      dot={false}
                      name="平均成本 (Avg Cost)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="h-64 mb-8 w-full">
                <h4 className="text-sm font-semibold text-gray-500 mb-2">總資產價值 vs 股票價值 (Total Asset Value vs Stock Value)</h4>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={results} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="actualDate" 
                      tickFormatter={(dateStr) => {
                         const date = new Date(dateStr);
                         return `${date.getFullYear()}-${date.getMonth() + 1}`;
                      }}
                      tick={{ fontSize: 10, fill: '#6b7280' }} 
                      axisLine={false} 
                      tickLine={false} 
                      interval="preserveStartEnd"
                      minTickGap={30}
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
                      labelFormatter={(label) => label}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <Line 
                      type="monotone" 
                      dataKey="totalValue" 
                      stroke="#2563eb" 
                      strokeWidth={2} 
                      dot={false}
                      name="股票價值 (Stock Value)"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="totalAssetValueWithDividends" 
                      stroke="#059669" 
                      strokeWidth={2} 
                      dot={false}
                      name="總資產價值 (Total Asset Value)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div id="sim-results-wrapper" className="overflow-hidden rounded-2xl border border-gray-100 shadow-sm bg-white/50 backdrop-blur-sm flex flex-col max-h-[600px]">
              <div className="overflow-auto custom-scrollbar">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-4 font-semibold">年月</th>
                      <th className="px-6 py-4 font-semibold">實際交易日</th>
                      <th className="px-6 py-4 font-semibold text-right">股價 (USD)</th>
                      <th className="px-6 py-4 font-semibold text-right">平均成本</th>
                      <th className="px-6 py-4 font-semibold text-right">現價差幅</th>
                      <th className="px-6 py-4 font-semibold text-right">每月投入</th>
                      <th className="px-6 py-4 font-semibold text-right">累積本金</th>
                      <th className="px-6 py-4 font-semibold text-right">新增股數</th>
                      <th className="px-6 py-4 font-semibold text-right">累積股數</th>
                      <th className="px-6 py-4 font-semibold text-right">當月派息</th>
                      <th className="px-6 py-4 font-semibold text-right">當時總資產</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {results.map((r, i) => (
                      <tr key={i} className="hover:bg-blue-50/30 transition-colors group">
                        <td className="px-6 py-4 font-medium text-gray-900">
                          {r.year}年{r.month}月
                        </td>
                        <td className="px-6 py-4 text-gray-500">{r.actualDate}</td>
                        <td className="px-6 py-4 text-right font-mono text-gray-600">${r.price.toFixed(2)}</td>
                        <td className="px-6 py-4 text-right font-mono text-gray-600">${r.averageCost.toFixed(2)}</td>
                        <td className={`px-6 py-4 text-right font-mono font-bold ${r.percentageDiff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {r.percentageDiff > 0 ? '+' : ''}{r.percentageDiff.toFixed(2)}%
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-gray-600">${r.monthlyPrincipal.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right font-mono text-gray-600">${r.totalPrincipal.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right font-mono text-gray-600">{r.sharesBought.toFixed(4)}</td>
                        <td className="px-6 py-4 text-right font-mono text-gray-600">{r.totalShares.toFixed(4)}</td>
                        <td className="px-6 py-4 text-right font-mono text-yellow-600 font-medium">
                          {r.dividendReceived > 0 ? (
                            <span>
                              +${r.dividendReceived.toFixed(2)}
                              <span className="text-xs text-gray-500 ml-1">(${r.dividendPerShare.toFixed(3)}/股)</span>
                            </span>
                          ) : '-'}
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-bold text-blue-600 group-hover:text-blue-700">
                          ${r.totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default function Resources() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-5xl mx-auto space-y-8 pb-24"
    >
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-700 p-8 rounded-3xl shadow-xl border border-blue-500/30 text-white mb-8 group">
        <div className="absolute top-0 right-0 -mt-16 -mr-16 w-80 h-80 bg-white opacity-10 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-1000"></div>
        <div className="absolute bottom-0 left-0 -mb-16 -ml-16 w-64 h-64 bg-blue-300 opacity-20 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-1000"></div>

        <div className="relative z-10 flex items-center gap-6 mb-2">
          <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-md border border-white/20 shadow-inner">
            <Library className="w-10 h-10 text-white" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2 drop-shadow-sm">
              資源庫 (Resources)
            </h1>
            <p className="text-blue-100 text-lg font-medium">
              實用的財務計算工具與過往市場數據模擬
            </p>
          </div>
        </div>
      </div>

      <InterestCalculator />
      <DCASimulator />
    </motion.div>
  );
}
