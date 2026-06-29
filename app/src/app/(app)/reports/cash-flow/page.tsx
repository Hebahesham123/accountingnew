"use client";

import { useMemo, useState } from "react";
import { useEntity } from "@/components/EntityContext";
import { useLedger, useProjects } from "@/lib/data";
import { filterRows, cashFlow } from "@/lib/reports";
import { fmtMoney } from "@/lib/format";
import { downloadCSV } from "@/lib/csv";
import { ReportToolbar, PageHeader, type ReportFilters } from "@/components/ReportToolbar";
import { Spinner, Card } from "@/components/ui";
import type { StatementLine } from "@/lib/reports";

export default function CashFlowPage() {
  const { entity, loading: entityLoading } = useEntity();
  const { rows, loading: ledgerLoading } = useLedger(entity?.id ?? null);
  const { projects } = useProjects(entity?.id ?? null);
  const [filters, setFilters] = useState<ReportFilters>({ from: "", to: "", projectId: "" });

  const f = useMemo(
    () => filterRows(rows, { from: filters.from || undefined, to: filters.to || undefined }, filters.projectId || undefined),
    [rows, filters]
  );
  const cf = useMemo(() => cashFlow(f), [f]);

  if (entityLoading) return <Spinner />;

  if (!entity) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <div className="text-6xl">🏢</div>
        <h2 className="text-lg font-bold text-slate-700">لا يوجد كيان محدد</h2>
        <p className="max-w-md text-sm text-slate-500">أضف كياناً من صفحة «الكيانات / الشركات» لعرض قائمة التدفقات النقدية.</p>
      </div>
    );
  }

  const currency = entity.currency;

  const onExport = () => {
    const r: (string | number)[][] = [];
    const push = (section: string, lines: StatementLine[], totalLabel: string, total: number) => {
      lines.forEach((l) => r.push([section, l.label, l.amount]));
      r.push([section, totalLabel, total]);
    };
    push("الأنشطة التشغيلية", cf.operating, "إجمالي التدفقات التشغيلية", cf.totalOperating);
    push("الأنشطة الاستثمارية", cf.investing, "إجمالي التدفقات الاستثمارية", cf.totalInvesting);
    push("الأنشطة التمويلية", cf.financing, "إجمالي التدفقات التمويلية", cf.totalFinancing);
    r.push(["", "صافي التغير في النقدية", cf.netChange]);
    downloadCSV(`قائمة_التدفقات_النقدية_${entity.name}`, ["القسم", "البند", "المبلغ"], r);
  };

  const Money = ({ v, className = "" }: { v: number; className?: string }) => (
    <span className={`num ${className}`}>{fmtMoney(v, currency)}</span>
  );

  const period =
    filters.from || filters.to
      ? `عن الفترة من ${filters.from || "البداية"} إلى ${filters.to || "الآن"}`
      : "عن كامل الفترة";

  const Section = ({ title, lines, totalLabel, total }: { title: string; lines: StatementLine[]; totalLabel: string; total: number }) => (
    <>
      <tr className="bg-slate-50">
        <td className="px-4 py-2 text-sm font-bold text-slate-700" colSpan={2}>{title}</td>
      </tr>
      {lines.length === 0 && (
        <tr><td colSpan={2} className="px-4 py-2 text-center text-slate-400">لا توجد حركة</td></tr>
      )}
      {lines.map((l) => (
        <tr key={l.key} className="text-slate-700">
          <td className="px-4 py-2">{l.label}</td>
          <td className="px-4 py-2 text-left">
            <Money v={l.amount} className={l.amount >= 0 ? "text-emerald-600" : "text-red-600"} />
          </td>
        </tr>
      ))}
      <tr className="font-bold text-slate-800">
        <td className="px-4 py-2">{totalLabel}</td>
        <td className="px-4 py-2 text-left"><Money v={total} /></td>
      </tr>
    </>
  );

  return (
    <>
      <PageHeader title="قائمة التدفقات النقدية" subtitle={entity.name} />
      <ReportToolbar filters={filters} setFilters={setFilters} projects={projects} onExport={onExport} />

      {ledgerLoading ? (
        <Spinner />
      ) : (
        <Card>
          {/* Title block */}
          <div className="mb-6 text-center">
            <h2 className="text-lg font-bold text-slate-800">{entity.name}</h2>
            <div className="mt-1 text-base font-semibold text-slate-700">قائمة التدفقات النقدية</div>
            <div className="mt-0.5 text-sm text-slate-500">{period}</div>
          </div>

          <div className="mx-auto max-w-2xl">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                <Section title="التدفقات من الأنشطة التشغيلية" lines={cf.operating} totalLabel="إجمالي التدفقات التشغيلية" total={cf.totalOperating} />
                <Section title="التدفقات من الأنشطة الاستثمارية" lines={cf.investing} totalLabel="إجمالي التدفقات الاستثمارية" total={cf.totalInvesting} />
                <Section title="التدفقات من الأنشطة التمويلية" lines={cf.financing} totalLabel="إجمالي التدفقات التمويلية" total={cf.totalFinancing} />

                <tr className={cf.netChange >= 0 ? "bg-emerald-50" : "bg-red-50"}>
                  <td className={`px-4 py-3 text-base font-bold ${cf.netChange >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                    صافي التغير في النقدية
                  </td>
                  <td className="px-4 py-3 text-left">
                    <Money v={cf.netChange} className={`text-base font-bold ${cf.netChange >= 0 ? "text-emerald-700" : "text-red-700"}`} />
                  </td>
                </tr>
              </tbody>
            </table>

            <p className="mt-4 text-xs leading-relaxed text-slate-400">
              ملاحظة: تم إعداد هذه القائمة باستخدام الطريقة غير المباشرة (متطابقة التدفق النقدي)، حيث يُحتسب التغير في النقدية من
              مجموع تأثير القيود على الحسابات غير النقدية مصنفةً إلى أنشطة تشغيلية واستثمارية وتمويلية.
            </p>
          </div>
        </Card>
      )}
    </>
  );
}
