import React, { useState, useEffect } from "react";
import { useAppContext, FinancialRecord } from "../store";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { Plus, Trash2, Calculator, Save, CheckCircle, Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import { motion } from "motion/react";

const COLORS = [
  "#10b981",
  "#f43f5e",
  "#3b82f6",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
];

export default function CashFlow() {
  const { state, addOrUpdateRecord, getLatestRecordBefore, getRecordForMonth, deleteRecord } = useAppContext()!;
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
  const [isNewRecord, setIsNewRecord] = useState(true);
  const [hasPastData, setHasPastData] = useState(false);

  const [record, setRecord] = useState<FinancialRecord>({
    id: `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`,
    year: selectedYear,
    month: selectedMonth,
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
  });

  const [estimated, setEstimated] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const exactRecord = getRecordForMonth(selectedYear, selectedMonth);
    const existingOrLatest = getLatestRecordBefore(selectedYear, selectedMonth);
    const id = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;

    if (exactRecord) {
      setRecord(exactRecord);
      setIsNewRecord(false);
      setHasPastData(true);
    } else if (existingOrLatest) {
      setRecord({
        ...existingOrLatest,
        id,
        year: selectedYear,
        month: selectedMonth,
      });
      setIsNewRecord(true);
      setHasPastData(true);
    } else {
      setRecord({
        id,
        year: selectedYear,
        month: selectedMonth,
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
      });
      setIsNewRecord(true);
      setHasPastData(false);
    }
    setEstimated(false);
  }, [selectedYear, selectedMonth]); // Intentionally removed state.records to prevent resetting estimated state on save

  const handleIncomeChange = (
    field: keyof FinancialRecord["income"],
    value: string,
  ) => {
    setRecord((prev) => ({
      ...prev,
      income: { ...prev.income, [field]: Number(value) || 0 },
    }));
    setEstimated(false);
  };

  const handleExpenseChange = (
    field: keyof FinancialRecord["expense"],
    value: string,
  ) => {
    setRecord((prev) => ({
      ...prev,
      expense: { ...prev.expense, [field]: Number(value) || 0 },
    }));
    setEstimated(false);
  };

  const handleDynamicChange = (
    type: "insurance" | "extra",
    index: number,
    field: "name" | "amount",
    value: string,
  ) => {
    setRecord((prev) => {
      const newArray = [...prev.expense[type]];
      if (field === "amount") {
        newArray[index] = { ...newArray[index], [field]: Number(value) || 0 };
      } else {
        newArray[index] = { ...newArray[index], [field]: value };
      }
      return { ...prev, expense: { ...prev.expense, [type]: newArray } };
    });
    setEstimated(false);
  };

  const addDynamicField = (type: "insurance" | "extra") => {
    setRecord((prev) => ({
      ...prev,
      expense: {
        ...prev.expense,
        [type]: [
          ...prev.expense[type],
          { id: Date.now().toString(), name: "", amount: 0 },
        ],
      },
    }));
    setEstimated(false);
  };

  const removeDynamicField = (type: "insurance" | "extra", index: number) => {
    setRecord((prev) => {
      const newArray = [...prev.expense[type]];
      newArray.splice(index, 1);
      return { ...prev, expense: { ...prev.expense, [type]: newArray } };
    });
    setEstimated(false);
  };

  const totalIncome = record.income.salary + record.income.allowance + record.income.rental;

  const staticExpenseTotal =
    record.expense.mortgage +
    record.expense.household +
    record.expense.utilities +
    record.expense.parking +
    record.expense.tuition +
    record.expense.hobby +
    record.expense.annuity +
    record.expense.tax +
    record.expense.personal;

  const insuranceTotal = record.expense.insurance.reduce(
    (a, b) => a + b.amount,
    0,
  );
  const extraTotal = record.expense.extra.reduce((a, b) => a + b.amount, 0);
  const totalExpense = staticExpenseTotal + insuranceTotal + extraTotal;

  const aggressiveSavings = totalIncome - totalExpense;
  const conservativeSavings = (totalIncome - totalExpense) * 0.85;

  const incomeVsExpenseData = [
    { name: "總開支 (Expenses)", value: totalExpense },
    {
      name: "儲蓄 (Savings)",
      value: aggressiveSavings > 0 ? aggressiveSavings : 0,
    },
  ];

  const expenseBreakdownData = [
    { name: "供樓/租金", value: record.expense.mortgage },
    { name: "家用", value: record.expense.household },
    { name: "家居費用", value: record.expense.utilities },
    { name: "停車場", value: record.expense.parking },
    { name: "學費", value: record.expense.tuition },
    { name: "興趣班", value: record.expense.hobby },
    { name: "保險", value: insuranceTotal },
    { name: "年金", value: record.expense.annuity },
    { name: "稅務", value: record.expense.tax },
    { name: "個人開支", value: record.expense.personal },
    { name: "額外開支", value: extraTotal },
  ].filter((item) => item.value > 0);

  const handleSave = () => {
    addOrUpdateRecord(record);
    setEstimated(true);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleDelete = () => {
    if (window.confirm("確定要刪除此月份的記錄嗎？ (Are you sure you want to delete this record?)")) {
      deleteRecord(record.id);
      setEstimated(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-5xl mx-auto space-y-8 pb-24"
    >
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 to-teal-700 p-8 rounded-3xl shadow-xl border border-emerald-500/30 text-white mb-8 group">
        <div className="absolute top-0 right-0 -mt-16 -mr-16 w-80 h-80 bg-white opacity-10 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-1000"></div>
        <div className="absolute bottom-0 left-0 -mb-16 -ml-16 w-64 h-64 bg-emerald-300 opacity-20 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-1000"></div>

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2 drop-shadow-sm">
              財務收支記錄
            </h1>
            <p className="text-emerald-50 text-lg font-medium">
              記錄每月收支，為您的財富增值打好穩固基礎
            </p>
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/20 backdrop-blur-md border border-white/20 text-sm font-semibold shadow-sm">
              {isNewRecord ? (
                hasPastData ? "✨ 已載入上期數據作參考" : "📝 建立新記錄"
              ) : (
                "✏️ 編輯現有記錄"
              )}
            </div>
          </div>
          <div className="flex gap-4 items-center bg-white/10 p-2 rounded-2xl backdrop-blur-md border border-white/20 shadow-inner">
            <div className="relative group/select">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="appearance-none bg-transparent text-white font-bold text-xl px-4 py-2 pr-8 focus:ring-0 focus:outline-none cursor-pointer [&>option]:text-gray-900"
              >
                {[...Array(10)].map((_, i) => {
                  const year = today.getFullYear() - 5 + i;
                  return (
                    <option key={year} value={year}>
                      {year}年
                    </option>
                  );
                })}
              </select>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-white/70">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
            <div className="w-px h-8 bg-white/20"></div>
            <div className="relative group/select">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="appearance-none bg-transparent text-white font-bold text-xl px-4 py-2 pr-8 focus:ring-0 focus:outline-none cursor-pointer [&>option]:text-gray-900"
              >
                {[...Array(12)].map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}月
                  </option>
                ))}
              </select>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-white/70">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {state.records.length > 0 && (
        <div className="bg-white/80 backdrop-blur-xl p-6 rounded-3xl shadow-lg border border-white/50 mb-8">
          <h2 className="text-lg font-bold text-emerald-800 mb-4 flex items-center gap-2">
            <CalendarIcon className="w-5 h-5" />
            已記錄數據的月份 (Saved Records)
          </h2>
          <div className="flex flex-wrap gap-3">
            {state.records.map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  setSelectedYear(r.year);
                  setSelectedMonth(r.month);
                }}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 ${
                  r.year === selectedYear && r.month === selectedMonth
                    ? "bg-emerald-600 text-white shadow-lg shadow-emerald-200 scale-105"
                    : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:scale-105 border border-emerald-100"
                }`}
              >
                {r.year}年{r.month}月
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Income Section */}
        <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-lg border border-white/50 relative overflow-hidden group hover:shadow-xl transition-all duration-300">
           <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
          <h2 className="text-xl font-bold text-emerald-800 mb-6 flex items-center gap-3 relative z-10">
            <div className="bg-emerald-100 p-2.5 rounded-xl shadow-sm">
              <Plus className="w-6 h-6 text-emerald-600" />
            </div>
            每月收入 (Income)
          </h2>
          <div className="space-y-5 relative z-10">
            {[
              { label: "薪金 (Salary)", key: "salary" },
              { label: "津貼 (Allowance)", key: "allowance" },
              { label: "出租收入 (Rental)", key: "rental" },
            ].map((item) => (
              <div key={item.key} className="group/input">
                <label className="block text-sm font-semibold text-gray-700 mb-2 ml-1 transition-colors group-focus-within/input:text-emerald-600">
                  {item.label}
                </label>
                <div className="relative transform transition-all duration-200 group-focus-within/input:-translate-y-1">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <span className="text-emerald-500 font-bold">$</span>
                  </div>
                  <input
                    type="number"
                    value={
                      record.income[
                        item.key as keyof FinancialRecord["income"]
                      ] || ""
                    }
                    onChange={(e) =>
                      handleIncomeChange(
                        item.key as keyof FinancialRecord["income"],
                        e.target.value,
                      )
                    }
                    className="block w-full pl-10 pr-4 py-3.5 bg-gray-50/50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all text-gray-900 font-medium placeholder:text-gray-400"
                    placeholder="0"
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 pt-6 border-t border-gray-100 flex justify-between items-center relative z-10">
            <span className="font-bold text-gray-600 text-lg">總收入</span>
            <span className="text-3xl font-extrabold text-emerald-600 tracking-tight">
              ${totalIncome.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Expense Section */}
        <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-lg border border-white/50 relative overflow-hidden group hover:shadow-xl transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-rose-50/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
          <h2 className="text-xl font-bold text-rose-800 mb-6 flex items-center gap-3 relative z-10">
            <div className="bg-rose-100 p-2.5 rounded-xl shadow-sm">
              <Trash2 className="w-6 h-6 text-rose-600" />
            </div>
            每月支出 (Expenses)
          </h2>
          <div className="space-y-5 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar relative z-10">
            {[
              { label: "供樓/租金 (Mortgage/Rent)", key: "mortgage" },
              { label: "家用 (Household)", key: "household" },
              { label: "家居基本費用 (Utilities)", key: "utilities" },
              { label: "停車場 (Parking)", key: "parking" },
              { label: "學費 (Tuition)", key: "tuition" },
              { label: "興趣班費用 (Hobby)", key: "hobby" },
              { label: "年金 (Annuity)", key: "annuity" },
              { label: "稅務 (Tax)", key: "tax" },
              { label: "個人開支 (Personal)", key: "personal" },
            ].map((item) => (
              <div key={item.key} className="group/input">
                <label className="block text-sm font-semibold text-gray-700 mb-2 ml-1 transition-colors group-focus-within/input:text-rose-600">
                  {item.label}
                </label>
                <div className="relative transform transition-all duration-200 group-focus-within/input:-translate-y-1">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <span className="text-rose-500 font-bold">$</span>
                  </div>
                  <input
                    type="number"
                    value={
                      record.expense[
                        item.key as keyof FinancialRecord["expense"]
                      ] || ""
                    }
                    onChange={(e) =>
                      handleExpenseChange(
                        item.key as keyof FinancialRecord["expense"],
                        e.target.value,
                      )
                    }
                    className="block w-full pl-10 pr-4 py-3.5 bg-gray-50/50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-rose-100 focus:border-rose-500 transition-all text-gray-900 font-medium placeholder:text-gray-400"
                    placeholder="0"
                  />
                </div>
              </div>
            ))}

            {/* Dynamic Insurance */}
            <div className="pt-6 border-t border-gray-100">
              <div className="flex justify-between items-center mb-4">
                <label className="block text-sm font-bold text-gray-700">
                  保險 (Insurance)
                </label>
                <button
                  onClick={() => addDynamicField("insurance")}
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors"
                >
                  <Plus className="w-3 h-3" /> 新增保險
                </button>
              </div>
              {record.expense.insurance.map((ins, index) => (
                <div key={ins.id} className="flex gap-3 mb-3 group/dynamic">
                  <input
                    type="text"
                    value={ins.name}
                    onChange={(e) =>
                      handleDynamicChange(
                        "insurance",
                        index,
                        "name",
                        e.target.value,
                      )
                    }
                    placeholder="保險名稱"
                    className="bg-gray-50/50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 block w-1/2 p-3 transition-all"
                  />
                  <div className="relative w-1/2 flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-rose-500 font-bold text-sm">
                        $
                      </span>
                      <input
                        type="number"
                        value={ins.amount || ""}
                        onChange={(e) =>
                          handleDynamicChange(
                            "insurance",
                            index,
                            "amount",
                            e.target.value,
                          )
                        }
                        className="pl-7 bg-gray-50/50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-4 focus:ring-rose-100 focus:border-rose-500 block w-full p-3 transition-all"
                        placeholder="0"
                      />
                    </div>
                    <button
                      onClick={() => removeDynamicField("insurance", index)}
                      className="text-rose-400 hover:text-rose-600 p-2 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Dynamic Extra */}
            <div className="pt-6 border-t border-gray-100">
              <div className="flex justify-between items-center mb-4">
                <label className="block text-sm font-bold text-gray-700">
                  額外開支 (Extra Expenses)
                </label>
                <button
                  onClick={() => addDynamicField("extra")}
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors"
                >
                  <Plus className="w-3 h-3" /> 新增開支
                </button>
              </div>
              {record.expense.extra.map((ext, index) => (
                <div key={ext.id} className="flex gap-3 mb-3 group/dynamic">
                  <input
                    type="text"
                    value={ext.name}
                    onChange={(e) =>
                      handleDynamicChange(
                        "extra",
                        index,
                        "name",
                        e.target.value,
                      )
                    }
                    placeholder="開支名稱"
                    className="bg-gray-50/50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 block w-1/2 p-3 transition-all"
                  />
                  <div className="relative w-1/2 flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-rose-500 font-bold text-sm">
                        $
                      </span>
                      <input
                        type="number"
                        value={ext.amount || ""}
                        onChange={(e) =>
                          handleDynamicChange(
                            "extra",
                            index,
                            "amount",
                            e.target.value,
                          )
                        }
                        className="pl-7 bg-gray-50/50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-4 focus:ring-rose-100 focus:border-rose-500 block w-full p-3 transition-all"
                        placeholder="0"
                      />
                    </div>
                    <button
                      onClick={() => removeDynamicField("extra", index)}
                      className="text-rose-400 hover:text-rose-600 p-2 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-gray-100 flex justify-between items-center relative z-10">
            <span className="font-bold text-gray-600 text-lg">總支出</span>
            <span className="text-3xl font-extrabold text-rose-600 tracking-tight">
              ${totalExpense.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
        <button
          onClick={handleSave}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 text-white px-10 py-4 rounded-2xl font-bold text-lg transition-all shadow-xl transform hover:-translate-y-1 ${
            isSaved
              ? "bg-emerald-500 shadow-emerald-500/30 ring-4 ring-emerald-200"
              : "bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-emerald-600/30"
          }`}
        >
          {isSaved ? (
            <>
              <CheckCircle className="w-6 h-6" />
              已儲存 (Saved!)
            </>
          ) : (
            <>
              <Calculator className="w-6 h-6" />
              估算及儲存記錄 (Estimate & Save)
            </>
          )}
        </button>
        {!isNewRecord && (
          <button
            onClick={handleDelete}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 text-rose-600 bg-white hover:bg-rose-50 px-10 py-4 rounded-2xl font-bold text-lg transition-all border-2 border-rose-100 hover:border-rose-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
          >
            <Trash2 className="w-6 h-6" />
            刪除記錄 (Delete)
          </button>
        )}
      </div>

      {/* Results Section */}
      {estimated && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-xl border border-white/50 mt-8 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 via-transparent to-transparent opacity-50 pointer-events-none" />
          
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-8 relative z-10">
            每月流動資金估算結果
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12 relative z-10">
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-6 rounded-2xl border border-emerald-100 relative overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Calculator className="w-24 h-24 text-emerald-600" />
              </div>
              <h3 className="text-lg font-semibold text-emerald-800 mb-2">
                進取型儲蓄 (Aggressive)
              </h3>
              <p className="text-sm text-emerald-600 mb-4 font-medium">
                收入直減開支 (Income - Expenses)
              </p>
              <p className="text-4xl font-bold text-emerald-700 tracking-tight">
                ${aggressiveSavings.toLocaleString()}
              </p>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-2xl border border-blue-100 relative overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Save className="w-24 h-24 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-blue-800 mb-2">
                保守型儲蓄 (Conservative)
              </h3>
              <p className="text-sm text-blue-600 mb-4 font-medium">
                進取型 x 85% (Aggressive x 85%)
              </p>
              <p className="text-4xl font-bold text-blue-700 tracking-tight">
                ${conservativeSavings.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 min-h-[400px] relative z-10">
            <div className="flex flex-col items-center w-full h-[400px] bg-white/50 rounded-2xl p-4 border border-white/50 shadow-inner">
              <h3 className="text-lg font-semibold text-gray-700 mb-4">
                收入分配 (Income Distribution)
              </h3>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={incomeVsExpenseData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                    labelLine={true}
                    style={{ fontSize: '12px', fontWeight: 500 }}
                  >
                    {incomeVsExpenseData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={index === 0 ? "#f43f5e" : "#10b981"}
                        strokeWidth={2}
                        stroke="#fff"
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => `$${value.toLocaleString()}`}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="flex flex-col items-center w-full h-[400px] bg-white/50 rounded-2xl p-4 border border-white/50 shadow-inner">
              <h3 className="text-lg font-semibold text-gray-700 mb-4">
                開支分佈 (Expense Breakdown)
              </h3>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseBreakdownData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : ''}
                    labelLine={false}
                    style={{ fontSize: '12px', fontWeight: 500 }}
                  >
                    {expenseBreakdownData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                        strokeWidth={2}
                        stroke="#fff"
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => `$${value.toLocaleString()}`}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
