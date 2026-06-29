"use client";

import { useMemo, useState } from "react";
import { useEntity } from "@/components/EntityContext";
import { useLedger, useProjects } from "@/lib/data";
import { filterRows, incomeStatement } from "@/lib/reports";
import { fmtMoney } from "@/lib/format";
import { downloadCSV } from "@/lib/csv";
import { ReportToolbar, PageHeader, type ReportFilters } from "@/components/ReportToolbar";
import { Spinner, Card } from "@/components/ui";

export default function IncomeStatementPage() {
  const { entity, loading: entityLoading } = useEntity();
  const { rows, loading: ledgerLoading } = useLedger(entity?.id ?? null);
  const { projects } = useProjects(entity?.id ?? null);
  const [filters, setFilters] = useState<ReportFilters>({ from: "", to: "", projectId: "" });

  const f = useMemo(
    () => filterRows(rows, { from: filters.from || undefined, to: filters.to || undefined }, filters.projectId || undefined),
    [rows, filters]
  );
  const is = useMemo(() => incomeStatement(f), [f]);

  if (entityLoading) return <Spinner />;

  if (!entity) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <div className="text-6xl">🏢</div>
        <h2 className="text-lg font-bold text-slate-700">لا يوجد كيان محدد</h2>
        <p className="max-w-md text-sm text-slate-500">أضف كياناً من صفحة «الكيانات / الشركات» لعرض قائمة الدخل.</p>
      </div>
    );
  }

  const currency = entity.currency;

  const onExport = () => {
    const r: (string | number)[][] = [];
    is.revenues.forEach((l) => r.push(["الإيرادات", l.label, l.amount]));
    r.push(["الإيرادات", "إجمالي الإيرادات", is.totalRevenue]);
    is.expenses.forEach((l) => r.push(["المصروفات", l.label, l.amount]));
    r.push(["المصروفات", "إجمالي المصروفات", is.totalExpense]);
    r.push(["", "صافي الربح / (الخسارة)", is.netIncome]);
    downloadCSV(`قائمة_الدخل_${entity.name}`, ["القسم", "البند", "المبلغ"], r);
  };

  const Money = ({ v, className = "" }: { v: number; className?: string }) => (
    <span className={`num ${className}`}>{fmtMoney(v, currency)}</span>
  );

  const period =
    filters.from || filters.to
      ? `عن الفترة من ${filters.from || "البداية"} إلى ${filters.to || "الآن"}`
      : "عن كامل الفترة";

  const maxBar = Math.max(is.totalRevenue, is.totalExpense, 1);

  return (
    <>
      <PageHeader title="قائمة الدخل" subtitle={entity.name} />
      <ReportToolbar filters={filters} setFilters={setFilters} projects={projects} onExport={onExport} />

      {ledgerLoading ? (
        <Spinner />
      ) : (
        <Card>
          {/* Title block */}
          <div className="mb-6 text-center">
            <h2 className="text-lg font-bold text-slate-800">{entity.name}</h2>
            <div className="mt-1 text-base font-semibold text-slate-700">قائمة الدخل</div>
            <div className="mt-0.5 text-sm text-slate-500">{period}</div>
          </div>

          <div className="mx-auto max-w-2xl">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {/* الإيرادات */}
                <tr className="bg-slate-50">
                  <td className="px-4 py-2 text-sm font-bold text-slate-700" colSpan={2}>الإيرادات</td>
                </tr>
                {is.revenues.length === 0 && (
                  <tr><td colSpan={2} className="px-4 py-2 text-center text-slate-400">لا توجد إيرادات</td></tr>
                )}
                {is.revenues.map((l) => (
                  <tr key={l.key} className="text-slate-700">
                    <td className="px-4 py-2">{l.label}</td>
                    <td className="px-4 py-2 text-left"><Money v={l.amount} /></td>
                  </tr>
                ))}
                <tr className="font-bold text-slate-800">
                  <td className="px-4 py-2">إجمالي الإيرادات</td>
                  <td className="px-4 py-2 text-left"><Money v={is.totalRevenue} className="text-emerald-600" /></td>
                </tr>

                {/* المصروفات */}
                <tr className="bg-slate-50">
                  <td className="px-4 py-2 text-sm font-bold text-slate-700" colSpan={2}>المصروفات</td>
                </tr>
                {is.expenses.length === 0 && (
                  <tr><td colSpan={2} className="px-4 py-2 text-center text-slate-400">لا توجد مصروفات</td></tr>
                )}
                {is.expenses.map((l) => (
                  <tr key={l.key} className="text-slate-700">
                    <td className="px-4 py-2">{l.label}</td>
                    <td className="px-4 py-2 text-left"><Money v={l.amount} /></td>
                  </tr>
                ))}
                <tr className="font-bold text-slate-800">
                  <td className="px-4 py-2">إجمالي المصروفات</td>
                  <td className="px-4 py-2 text-left"><Money v={is.totalExpense} className="text-amber-600" /></td>
                </tr>

                {/* صافي الربح */}
                <tr className={is.netIncome >= 0 ? "bg-emerald-50" : "bg-red-50"}>
                  <td className={`px-4 py-3 text-base font-bold ${is.netIncome >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                    صافي الربح / (الخسارة)
                  </td>
                  <td className="px-4 py-3 text-left">
                    <Money v={is.netIncome} className={`text-base font-bold ${is.netIncome >= 0 ? "text-emerald-700" : "text-red-700"}`} />
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Bar comparing revenue vs expense */}
            <div className="mt-6 space-y-3">
              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                  <span>الإيرادات</span>
                  <Money v={is.totalRevenue} />
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(is.totalRevenue / maxBar) * 100}%` }} />
                </div>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                  <span>المصروفات</span>
                  <Money v={is.totalExpense} />
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-amber-500" style={{ width: `${(is.totalExpense / maxBar) * 100}%` }} />
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}
    </>
  );
}
