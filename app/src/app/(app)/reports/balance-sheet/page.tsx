"use client";

import { useMemo, useState } from "react";
import { useEntity } from "@/components/EntityContext";
import { useLedger, useProjects } from "@/lib/data";
import { filterRows, balanceSheet } from "@/lib/reports";
import { fmtMoney } from "@/lib/format";
import { downloadCSV } from "@/lib/csv";
import { ReportToolbar, PageHeader, type ReportFilters } from "@/components/ReportToolbar";
import { Spinner, Card, Badge } from "@/components/ui";

export default function BalanceSheetPage() {
  const { entity, loading: entityLoading } = useEntity();
  const { rows, loading: ledgerLoading } = useLedger(entity?.id ?? null);
  const { projects } = useProjects(entity?.id ?? null);
  const [filters, setFilters] = useState<ReportFilters>({ from: "", to: "", projectId: "" });

  const f = useMemo(
    () => filterRows(rows, { from: filters.from || undefined, to: filters.to || undefined }, filters.projectId || undefined),
    [rows, filters]
  );
  const bs = useMemo(() => balanceSheet(f), [f]);

  if (entityLoading) return <Spinner />;

  if (!entity) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <div className="text-6xl">🏢</div>
        <h2 className="text-lg font-bold text-slate-700">لا يوجد كيان محدد</h2>
        <p className="max-w-md text-sm text-slate-500">أضف كياناً من صفحة «الكيانات / الشركات» لعرض الميزانية العمومية.</p>
      </div>
    );
  }

  const currency = entity.currency;

  const onExport = () => {
    const r: (string | number)[][] = [];
    bs.assets.forEach((l) => r.push(["الأصول", l.label, l.amount]));
    r.push(["الأصول", "إجمالي الأصول", bs.totalAssets]);
    bs.liabilities.forEach((l) => r.push(["الالتزامات", l.label, l.amount]));
    r.push(["الالتزامات", "إجمالي الالتزامات", bs.totalLiabilities]);
    bs.equity.forEach((l) => r.push(["حقوق الملكية", l.label, l.amount]));
    r.push(["حقوق الملكية", "صافي الربح/الخسارة للفترة", bs.netIncome]);
    r.push(["حقوق الملكية", "إجمالي حقوق الملكية", bs.totalEquity]);
    r.push(["", "إجمالي الخصوم وحقوق الملكية", bs.totalLiabAndEquity]);
    downloadCSV(`الميزانية_العمومية_${entity.name}`, ["القسم", "البند", "المبلغ"], r);
  };

  const Money = ({ v, className = "" }: { v: number; className?: string }) => (
    <span className={`num ${className}`}>{fmtMoney(v, currency)}</span>
  );

  return (
    <>
      <PageHeader title="الميزانية العمومية" subtitle={entity.name} />
      <ReportToolbar filters={filters} setFilters={setFilters} projects={projects} onExport={onExport} />

      {ledgerLoading ? (
        <Spinner />
      ) : (
        <Card>
          {/* Title block */}
          <div className="mb-6 text-center">
            <h2 className="text-lg font-bold text-slate-800">{entity.name}</h2>
            <div className="mt-1 text-base font-semibold text-slate-700">الميزانية العمومية</div>
            <div className="mt-0.5 text-sm text-slate-500">
              كما في <span className="num">{filters.to || "التاريخ الحالي"}</span>
            </div>
            <div className="mt-3 flex justify-center">
              {bs.balanced ? (
                <Badge color="green">الميزانية متوازنة ✓</Badge>
              ) : (
                <Badge color="red">
                  فرق: <Money v={bs.totalAssets - bs.totalLiabAndEquity} /> {currency}
                </Badge>
              )}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* LEFT column visually = الخصوم وحقوق الملكية (placed second so RTL puts assets on right) */}
            {/* RIGHT column = الأصول */}
            <section className="order-1 md:order-2 rounded-lg border border-slate-200">
              <div className="bg-slate-50 px-4 py-2 text-sm font-bold text-slate-700">الأصول</div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {bs.assets.length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-4 py-3 text-center text-slate-400">لا توجد أصول</td>
                    </tr>
                  )}
                  {bs.assets.map((l) => (
                    <tr key={l.key} className="text-slate-700">
                      <td className="px-4 py-2">{l.label}</td>
                      <td className="px-4 py-2 text-left"><Money v={l.amount} /></td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-bold text-slate-800">
                    <td className="px-4 py-2">إجمالي الأصول</td>
                    <td className="px-4 py-2 text-left"><Money v={bs.totalAssets} /></td>
                  </tr>
                </tbody>
              </table>
            </section>

            {/* الخصوم وحقوق الملكية */}
            <section className="order-2 md:order-1 rounded-lg border border-slate-200">
              <div className="bg-slate-50 px-4 py-2 text-sm font-bold text-slate-700">الخصوم وحقوق الملكية</div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {/* الالتزامات */}
                  <tr className="bg-slate-50/60 text-xs font-bold text-slate-600">
                    <td className="px-4 pt-3 pb-1" colSpan={2}>الالتزامات</td>
                  </tr>
                  {bs.liabilities.map((l) => (
                    <tr key={l.key} className="text-slate-700">
                      <td className="px-4 py-2">{l.label}</td>
                      <td className="px-4 py-2 text-left"><Money v={l.amount} /></td>
                    </tr>
                  ))}
                  <tr className="font-bold text-slate-800">
                    <td className="px-4 py-2">إجمالي الالتزامات</td>
                    <td className="px-4 py-2 text-left"><Money v={bs.totalLiabilities} /></td>
                  </tr>

                  {/* حقوق الملكية */}
                  <tr className="bg-slate-50/60 text-xs font-bold text-slate-600">
                    <td className="px-4 pt-3 pb-1" colSpan={2}>حقوق الملكية</td>
                  </tr>
                  {bs.equity.map((l) => (
                    <tr key={l.key} className="text-slate-700">
                      <td className="px-4 py-2">{l.label}</td>
                      <td className="px-4 py-2 text-left"><Money v={l.amount} /></td>
                    </tr>
                  ))}
                  <tr className="text-slate-700">
                    <td className="px-4 py-2">صافي الربح/الخسارة للفترة</td>
                    <td className="px-4 py-2 text-left">
                      <Money v={bs.netIncome} className={bs.netIncome >= 0 ? "text-emerald-600" : "text-red-600"} />
                    </td>
                  </tr>
                  <tr className="font-bold text-slate-800">
                    <td className="px-4 py-2">إجمالي حقوق الملكية</td>
                    <td className="px-4 py-2 text-left"><Money v={bs.totalEquity} /></td>
                  </tr>

                  {/* إجمالي */}
                  <tr className="bg-brand-50 font-bold text-brand-700">
                    <td className="px-4 py-3">إجمالي الخصوم وحقوق الملكية</td>
                    <td className="px-4 py-3 text-left"><Money v={bs.totalLiabAndEquity} /></td>
                  </tr>
                </tbody>
              </table>
            </section>
          </div>
        </Card>
      )}
    </>
  );
}
