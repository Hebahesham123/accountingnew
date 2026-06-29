"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useEntity } from "@/components/EntityContext";
import { useLedger, useEntries } from "@/lib/data";
import { balanceSheet, incomeStatement, cashFlow, projectSummary } from "@/lib/reports";
import { fmtMoney, fmtDate } from "@/lib/format";
import { Card, Spinner, Badge } from "@/components/ui";
import { PageHeader } from "@/components/ReportToolbar";

interface Kpi {
  label: string;
  value: number;
  icon: string;
  border: string;
  bg: string;
  iconBg: string;
  valueColor?: string;
}

export default function DashboardPage() {
  const { entity, loading: entityLoading } = useEntity();
  const { rows, loading: ledgerLoading } = useLedger(entity?.id ?? null);
  const { entries, loading: entriesLoading } = useEntries(entity?.id ?? null);

  const bs = useMemo(() => balanceSheet(rows), [rows]);
  const is = useMemo(() => incomeStatement(rows), [rows]);
  const cf = useMemo(() => cashFlow(rows), [rows]);
  const projects = useMemo(() => projectSummary(rows), [rows]);

  if (entityLoading) {
    return <Spinner />;
  }

  if (!entity) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <div className="text-6xl">🏢</div>
        <h2 className="text-lg font-bold text-slate-700">لا يوجد كيان محدد</h2>
        <p className="max-w-md text-sm text-slate-500">
          لم تقم بإضافة أي شركة أو كيان بعد. أضف كياناً من صفحة «الكيانات / الشركات» للبدء في عرض
          لوحة التحكم والتقارير.
        </p>
        <Link
          href="/entities"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          الانتقال إلى الكيانات / الشركات
        </Link>
      </div>
    );
  }

  const currency = entity.currency;

  if (ledgerLoading) {
    return (
      <>
        <PageHeader title="لوحة التحكم" subtitle={entity.name} />
        <Spinner />
      </>
    );
  }

  const netIncomeColor = is.netIncome >= 0 ? "text-emerald-600" : "text-red-600";
  const netChangeColor = cf.netChange >= 0 ? "text-emerald-600" : "text-red-600";

  const kpis: Kpi[] = [
    {
      label: "إجمالي الأصول",
      value: bs.totalAssets,
      icon: "💰",
      border: "border-brand-200",
      bg: "bg-brand-50",
      iconBg: "bg-brand-100",
      valueColor: "text-brand-700",
    },
    {
      label: "إجمالي الالتزامات",
      value: bs.totalLiabilities,
      icon: "📋",
      border: "border-amber-200",
      bg: "bg-amber-50",
      iconBg: "bg-amber-100",
      valueColor: "text-amber-700",
    },
    {
      label: "حقوق الملكية",
      value: bs.totalEquity,
      icon: "🏦",
      border: "border-indigo-200",
      bg: "bg-indigo-50",
      iconBg: "bg-indigo-100",
      valueColor: "text-indigo-700",
    },
    {
      label: "صافي الربح / الخسارة",
      value: is.netIncome,
      icon: is.netIncome >= 0 ? "📈" : "📉",
      border: is.netIncome >= 0 ? "border-emerald-200" : "border-red-200",
      bg: is.netIncome >= 0 ? "bg-emerald-50" : "bg-red-50",
      iconBg: is.netIncome >= 0 ? "bg-emerald-100" : "bg-red-100",
      valueColor: netIncomeColor,
    },
    {
      label: "صافي التغير في النقدية",
      value: cf.netChange,
      icon: "💵",
      border: cf.netChange >= 0 ? "border-emerald-200" : "border-red-200",
      bg: cf.netChange >= 0 ? "bg-emerald-50" : "bg-red-50",
      iconBg: cf.netChange >= 0 ? "bg-emerald-100" : "bg-red-100",
      valueColor: netChangeColor,
    },
  ];

  const latestEntries = entries.slice(0, 8);
  const topProjects = projects.slice(0, 8);

  return (
    <>
      <PageHeader title="لوحة التحكم" subtitle={entity.name} />

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {kpis.map((k) => (
          <div
            key={k.label}
            className={`rounded-xl border ${k.border} ${k.bg} p-4 shadow-sm transition hover:shadow-md`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-semibold text-slate-600">{k.label}</span>
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg ${k.iconBg}`}
              >
                {k.icon}
              </span>
            </div>
            <div className={`num mt-3 text-xl font-bold ${k.valueColor ?? "text-slate-800"}`}>
              {fmtMoney(k.value, currency)}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-400">{currency}</div>
          </div>
        ))}
      </div>

      {/* Balanced note */}
      <div className="mt-4">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-semibold text-slate-600">حالة توازن الميزانية</span>
            {bs.balanced ? (
              <Badge color="green">الميزانية متوازنة ✓</Badge>
            ) : (
              <Badge color="red">
                غير متوازنة — الفرق:{" "}
                <span className="num">
                  {fmtMoney(bs.totalAssets - bs.totalLiabAndEquity, currency)}
                </span>{" "}
                {currency}
              </Badge>
            )}
          </div>
        </Card>
      </div>

      {/* Two-column section */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Latest entries */}
        <Card
          title="أحدث القيود"
          actions={
            <Link href="/journal" className="text-xs font-semibold text-brand-600 hover:underline">
              عرض الكل
            </Link>
          }
        >
          {entriesLoading ? (
            <div className="py-6 text-center text-sm text-slate-400">جارٍ التحميل…</div>
          ) : latestEntries.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-400">لا توجد قيود بعد.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-right text-xs text-slate-500">
                    <th className="pb-2 font-semibold">رقم القيد</th>
                    <th className="pb-2 font-semibold">التاريخ</th>
                    <th className="pb-2 font-semibold">البيان</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {latestEntries.map((e) => (
                    <tr key={e.id} className="text-slate-700">
                      <td className="py-2 pe-3">
                        <span className="num font-semibold">{e.entry_no}</span>
                      </td>
                      <td className="py-2 pe-3 whitespace-nowrap text-slate-500">
                        <span className="num">{fmtDate(e.date)}</span>
                      </td>
                      <td className="py-2 max-w-[16rem] truncate">{e.description || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Project summary */}
        <Card
          title="ملخص المشاريع"
          actions={
            <Link href="/journal" className="text-xs font-semibold text-brand-600 hover:underline">
              التفاصيل
            </Link>
          }
        >
          {topProjects.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-400">لا توجد بيانات مشاريع.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-right text-xs text-slate-500">
                    <th className="pb-2 font-semibold">المشروع</th>
                    <th className="pb-2 font-semibold text-left">الإيرادات</th>
                    <th className="pb-2 font-semibold text-left">المصروفات</th>
                    <th className="pb-2 font-semibold text-left">الصافي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {topProjects.map((p) => (
                    <tr key={p.project_id ?? "__none__"} className="text-slate-700">
                      <td className="py-2 pe-3 max-w-[12rem] truncate">{p.project_name}</td>
                      <td className="py-2 text-left">
                        <span className="num text-emerald-600">{fmtMoney(p.revenue, currency)}</span>
                      </td>
                      <td className="py-2 text-left">
                        <span className="num text-amber-600">{fmtMoney(p.expense, currency)}</span>
                      </td>
                      <td className="py-2 text-left">
                        <span
                          className={`num font-semibold ${
                            p.net >= 0 ? "text-emerald-600" : "text-red-600"
                          }`}
                        >
                          {fmtMoney(p.net, currency)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
