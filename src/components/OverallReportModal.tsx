import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { X, FileText, Download } from 'lucide-react';
import { AppState } from '../store';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface OverallReportModalProps {
  state: AppState;
  categories: string[];
  realTimePrices: Record<string, number>;
  onClose: () => void;
}

const CustomDot = (props: any) => {
  const { cx, cy, payload } = props;
  if (payload.type === 'Buy' || payload.type === 'DCA') {
    return <circle cx={cx} cy={cy} r={4} fill="#10b981" stroke="white" strokeWidth={2} />;
  }
  if (payload.type === 'Sell') {
    return <circle cx={cx} cy={cy} r={4} fill="#ef4444" stroke="white" strokeWidth={2} />;
  }
  return <circle cx={cx} cy={cy} r={3} fill="#3b82f6" stroke="white" strokeWidth={1} />;
};

export const OverallReportModal: React.FC<OverallReportModalProps> = ({ state, categories, realTimePrices, onClose }) => {
  const reportRef = useRef<HTMLDivElement>(null);

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    try {
      const element = reportRef.current;
      const targetWidth = Math.max(element.scrollWidth, 1200);

      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
        width: targetWidth,
        windowWidth: targetWidth,
        onclone: (clonedDoc, clonedElement) => {
          // Force the cloned element to expand fully
          clonedElement.style.width = `${targetWidth}px`;
          clonedElement.style.minWidth = `${targetWidth}px`;
          clonedElement.style.height = 'auto';
          clonedElement.style.maxHeight = 'none';
          clonedElement.style.overflow = 'visible';
          clonedElement.style.position = 'static';
          clonedElement.style.transform = 'none';

          // Expand all scrollable containers inside the clone
          const scrollContainers = clonedElement.querySelectorAll('.custom-scrollbar, #report-table-body, .overflow-x-auto');
          scrollContainers.forEach((el) => {
            const htmlEl = el as HTMLElement;
            htmlEl.style.overflow = 'visible';
            htmlEl.style.height = 'auto';
            htmlEl.style.maxHeight = 'none';
            htmlEl.style.width = '100%';
          });

          // Unconstrain all parent elements up to the body
          let parent = clonedElement.parentElement;
          while (parent && parent !== clonedDoc.body) {
            parent.style.overflow = 'visible';
            parent.style.position = 'static';
            parent.style.transform = 'none';
            parent.style.width = 'auto';
            parent.style.height = 'auto';
            parent.style.maxHeight = 'none';
            parent.style.maxWidth = 'none';
            parent = parent.parentElement;
          }
        }
      });

      const imgData = canvas.toDataURL("image/jpeg", 1.0);
      
      // Always use landscape for overall report to fit wide tables
      const pdf = new jsPDF({
        orientation: 'l',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });

      pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
      pdf.save(`overall_dca_report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error("Failed to export PDF", err);
      alert("匯出 PDF 失敗 (Failed to export PDF)");
    }
  };

  // Calculate overall stats
  let totalInvested = 0;
  let totalAssetValue = 0;
  let totalProfit = 0;
  
  const categoryReports = categories.map(category => {
    const isLiquidity = category === "現金儲備／定期" || category === "流動資金及定期存款";
    const baseCategory = category.includes(" - ") ? category.split(" - ")[0] : category;
    const ticker = category.includes(" - ") ? category.split(" - ")[1] : "";
    
    const isUSStock = /^[A-Za-z]/.test(ticker);
    const exchangeRate = isUSStock ? 7.8 : 1;
    
    const categoryDCARecords = state.dcaRecords.filter(r => (r.category === baseCategory && (ticker ? r.ticker === ticker : true)) || (!r.category && baseCategory === "一般定投"));
    const categoryTradeRecords = state.tradeRecords.filter(r => (r.category === baseCategory && (ticker ? r.ticker === ticker : true)) || (!r.category && baseCategory === "一般定投"));
    
    const timeline: any[] = [];

    if (isLiquidity) {
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

      state.dcaRecords.forEach(r => {
        let date = new Date(r.year, r.month - 1, 1);
        if (r.period === "15號") {
          date = new Date(r.year, r.month - 1, 15);
        }
        
        const isRecordLiquidity = r.category === "現金儲備／定期" || r.category === "流動資金及定期存款" || (!r.category && (category === "現金儲備／定期" || category === "流動資金及定期存款"));
        
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
    
    const reportData = timeline.map(item => {
      if (isLiquidity) {
        cumulativePrincipal += item.amount;
        cumulativeShares += item.shares;
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
          cumulativeShares,
          currentAssetValue,
          averageCost,
          percentageDiff,
          dividendReceived: currentDividend,
          cumulativeDividends,
          totalAssetValueWithDividends,
        };
      }
    });

    const lastRecord = reportData[reportData.length - 1];
    const catInvested = lastRecord ? lastRecord.cumulativePrincipal : 0;
    const catInvestedInHKD = catInvested * exchangeRate;
    
    let catAssetValue = 0;
    if (isLiquidity) {
      catAssetValue = lastRecord ? lastRecord.cumulativeShares : 0;
    } else {
      const currentPrice = realTimePrices[category] || (lastRecord ? lastRecord.price : 0);
      catAssetValue = lastRecord ? (lastRecord.cumulativeShares * currentPrice + lastRecord.cumulativeDividends) : 0;
    }
    const catAssetValueInHKD = catAssetValue * exchangeRate;
    
    const catProfit = catAssetValue - catInvested;

    if (!isLiquidity) {
      totalInvested += catInvestedInHKD;
      totalAssetValue += catAssetValueInHKD;
    } else {
      // For liquidity, it's global, so we only add it once. Wait, if there are multiple liquidity categories?
      // Usually there's only one.
      totalInvested += catInvestedInHKD;
      totalAssetValue += catAssetValueInHKD;
    }

    return {
      category,
      isLiquidity,
      isUSStock,
      exchangeRate,
      reportData,
      catInvested,
      catAssetValue,
      catProfit
    };
  });

  // Calculate global totals properly
  // Since liquidity is global, we should be careful not to double count if there are multiple liquidity tabs.
  // Actually, the above loop adds liquidity to totalInvested and totalAssetValue.
  totalProfit = totalAssetValue - totalInvested;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto"
    >
      <motion.div
        ref={reportRef}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl h-[95vh] overflow-hidden flex flex-col relative"
      >
        <div className="p-6 border-b border-gray-100 flex justify-between items-center shrink-0 z-20 bg-white" style={{ backgroundColor: '#f9fafb' }}>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-600" /> 總報告 (Overall Report)
          </h2>
          <div className="flex items-center gap-4">
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all text-sm font-bold shadow-md"
              data-html2canvas-ignore="true"
            >
              <Download className="w-4 h-4" /> 匯出 PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 rounded-full transition-colors"
              data-html2canvas-ignore="true"
            >
              <X className="w-6 h-6 text-gray-500" />
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto custom-scrollbar bg-white p-8 space-y-12" style={{ backgroundColor: '#ffffff', color: '#111827' }}>
          
          {/* Summary Section */}
          <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200">
            <h3 className="text-xl font-bold text-gray-900 mb-6 border-b border-gray-200 pb-4">總覽 (Summary)</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <p className="text-sm text-gray-500 font-medium mb-1">總投入資金 (Total Invested HKD)</p>
                <p className="text-2xl font-bold text-gray-900">${totalInvested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <p className="text-sm text-gray-500 font-medium mb-1">現時資產總值 (Total Asset Value HKD)</p>
                <p className="text-2xl font-bold text-blue-600">${totalAssetValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <p className="text-sm text-gray-500 font-medium mb-1">總盈利 (Total Profit HKD)</p>
                <p className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {totalProfit > 0 ? '+' : ''}{totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <p className="text-sm text-gray-500 font-medium mb-1">現時現金儲備 (Current Cash Reserve HKD)</p>
                <p className="text-2xl font-bold text-indigo-600">
                  ${(categoryReports.find(cr => cr.isLiquidity)?.catAssetValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>
            
            <div className="mt-8">
              <h4 className="text-md font-bold text-gray-700 mb-4">現時資產分佈 (Asset Distribution)</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {categoryReports.map(cr => {
                  const assetValueInHKD = cr.catAssetValue * cr.exchangeRate;
                  return (
                    <div key={cr.category} className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                      <p className="text-xs text-gray-500 font-bold truncate" title={cr.category}>{cr.category}</p>
                      <p className="text-lg font-bold text-gray-900">
                        ${cr.catAssetValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        {!cr.isLiquidity && cr.isUSStock && <span className="text-xs text-gray-400 font-normal ml-1">(HKD ${assetValueInHKD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</span>}
                      </p>
                      <p className="text-xs text-gray-400">
                        {totalAssetValue > 0 ? ((assetValueInHKD / totalAssetValue) * 100).toFixed(1) : 0}%
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Individual Category Reports */}
          {categoryReports.map(cr => (
            <div key={cr.category} className="border-t border-gray-200 pt-8">
              <h3 className="text-xl font-bold text-gray-900 mb-6">{cr.category}</h3>
              
              {/* Chart */}
              <div className="h-64 mb-6 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={cr.reportData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
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
                    {cr.isLiquidity ? (
                      <>
                        <Line type="monotone" dataKey="currentAssetValue" stroke="#2563eb" strokeWidth={2} dot={<CustomDot />} activeDot={{ r: 6 }} name="結餘 (Balance)" />
                        <Line type="monotone" dataKey="totalAssetValueWithDividends" stroke="#059669" strokeWidth={2} dot={false} activeDot={{ r: 6 }} name="總資產價值 (Total Asset Value)" />
                      </>
                    ) : (
                      <>
                        <Line type="monotone" dataKey="price" stroke="#2563eb" strokeWidth={2} dot={<CustomDot />} activeDot={{ r: 6 }} name={`股票每月價格 (Monthly Price${cr.isUSStock ? ' USD' : ''})`} />
                        <Line type="monotone" dataKey="averageCost" stroke="#9333ea" strokeWidth={2} strokeDasharray="5 5" dot={false} name={`平均買入價 (Avg Cost${cr.isUSStock ? ' USD' : ''})`} />
                      </>
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Table */}
              <div className="overflow-x-auto custom-scrollbar border border-gray-200 rounded-xl">
                <div className="min-w-[1200px]">
                  <div className="bg-gray-50 border-b border-gray-200 px-4 py-2">
                     <div className="grid gap-4 text-xs font-semibold text-gray-500 uppercase" style={{ gridTemplateColumns: '1.2fr 0.8fr 1fr 1fr 1fr 1fr 1.2fr 1fr 1fr 1.2fr 0.8fr 0.8fr 1.2fr' }}>
                        <div>日期</div>
                        <div>類型</div>
                        <div className="text-right">{cr.isLiquidity ? '單位價值' : (cr.isUSStock ? '股價 (USD)' : '股價')}</div>
                        <div className="text-right">平均成本</div>
                        <div className="text-right">現價差幅</div>
                        <div className="text-right">變動金額</div>
                        <div className="text-right">累積本金 (Net)</div>
                        <div className="text-right">{cr.isLiquidity ? '變動結餘' : '變動股數'}</div>
                        <div className="text-right">{cr.isLiquidity ? '累積結餘' : '累積股數'}</div>
                        <div className="text-right">{cr.isLiquidity ? '結餘價值' : '股票價值'}</div>
                        <div className="text-right">{cr.isLiquidity ? '利息' : '每股派息'}</div>
                        <div className="text-right">{cr.isLiquidity ? '當月利息' : '當月派息'}</div>
                        <div className="text-right">總資產價值</div>
                     </div>
                  </div>
                  <div className="px-4 py-2">
                     <div className="divide-y divide-gray-100">
                        {cr.reportData.map((row, i) => (
                        <div key={i} className="grid gap-4 py-2 hover:bg-gray-50 transition-colors items-center text-xs" style={{ gridTemplateColumns: '1.2fr 0.8fr 1fr 1fr 1fr 1fr 1.2fr 1fr 1fr 1.2fr 0.8fr 0.8fr 1.2fr' }}>
                          <div className="font-medium text-gray-900">{row.displayDate}</div>
                          <div>
                            <span className={`px-2 py-1 rounded font-bold ${
                              row.type === 'DCA' ? 'bg-blue-100 text-blue-700' :
                              row.type === 'Buy' || row.type === 'Trade Buy' ? 'bg-emerald-100 text-emerald-700' :
                              row.type === 'Sell' || row.type === 'Trade Sell' ? 'bg-rose-100 text-rose-700' :
                              row.type === 'Remainder' ? 'bg-amber-100 text-amber-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {row.type}
                            </span>
                          </div>
                          <div className="text-right font-mono">
                            {row.type === 'Dividend' ? '-' : '$' + row.price.toFixed(2)}
                            {!cr.isLiquidity && cr.isUSStock && row.type !== 'Dividend' && <div className="text-[10px] text-gray-400">HKD ${(row.price * cr.exchangeRate).toFixed(2)}</div>}
                          </div>
                          <div className="text-right font-mono">
                            ${row.averageCost.toFixed(2)}
                            {!cr.isLiquidity && cr.isUSStock && <div className="text-[10px] text-gray-400">HKD ${(row.averageCost * cr.exchangeRate).toFixed(2)}</div>}
                          </div>
                          <div className={`text-right font-mono font-bold ${row.percentageDiff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {row.type === 'Dividend' ? '-' : (row.percentageDiff > 0 ? '+' : '') + row.percentageDiff.toFixed(2) + '%'}
                          </div>
                          <div className={`text-right font-mono font-bold ${row.amount > 0 ? 'text-emerald-600' : row.amount < 0 ? 'text-rose-600' : 'text-gray-600'}`}>
                            {row.type === 'Dividend' ? '-' : (row.amount > 0 ? '+' : '') + row.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            {!cr.isLiquidity && cr.isUSStock && row.type !== 'Dividend' && <div className="text-[10px] text-gray-400 font-normal">HKD ${(row.amount * cr.exchangeRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>}
                          </div>
                          <div className="text-right font-mono font-bold text-gray-900">
                            ${row.cumulativePrincipal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            {!cr.isLiquidity && cr.isUSStock && <div className="text-[10px] text-gray-400 font-normal">HKD ${(row.cumulativePrincipal * cr.exchangeRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>}
                          </div>
                          <div className={`text-right font-mono ${row.shares > 0 ? 'text-emerald-600' : row.shares < 0 ? 'text-rose-600' : 'text-gray-600'}`}>
                            {row.type === 'Dividend' ? '-' : (row.shares > 0 ? '+' : '') + row.shares.toFixed(2)}
                          </div>
                          <div className="text-right font-mono font-bold text-blue-600">
                            {row.cumulativeShares.toFixed(2)}
                          </div>
                          <div className="text-right font-mono font-bold text-gray-900">
                            {row.type === 'Dividend' ? '-' : '$' + row.currentAssetValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            {!cr.isLiquidity && cr.isUSStock && row.type !== 'Dividend' && <div className="text-[10px] text-gray-400 font-normal">HKD ${(row.currentAssetValue * cr.exchangeRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>}
                          </div>
                          <div className="text-right font-mono text-gray-500">
                            {row.dividendPerShare ? `$${row.dividendPerShare.toFixed(2)}` : '-'}
                            {!cr.isLiquidity && cr.isUSStock && row.dividendPerShare > 0 && <div className="text-[10px] text-gray-400 font-normal">HKD ${(row.dividendPerShare * cr.exchangeRate).toFixed(2)}</div>}
                          </div>
                          <div className="text-right font-mono text-emerald-600">
                            {row.dividendReceived ? `+$${row.dividendReceived.toFixed(2)}` : '-'}
                            {!cr.isLiquidity && cr.isUSStock && row.dividendReceived > 0 && <div className="text-[10px] text-emerald-400 font-normal">HKD ${(row.dividendReceived * cr.exchangeRate).toFixed(2)}</div>}
                          </div>
                          <div className="text-right font-mono font-bold text-indigo-600">
                            {row.type === 'Dividend' ? '-' : '$' + row.totalAssetValueWithDividends.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            {!cr.isLiquidity && cr.isUSStock && row.type !== 'Dividend' && <div className="text-[10px] text-indigo-400 font-normal">HKD ${(row.totalAssetValueWithDividends * cr.exchangeRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>}
                          </div>
                        </div>
                        ))}
                     </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
};
