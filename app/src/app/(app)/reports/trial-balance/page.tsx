"use client";
import { useMemo, useState } from "react";
import { useEntity } from "@/components/EntityContext";
import { useLedger, useProjects } from "@/lib/data";
import { filterRows, trialBalance } from "@/lib/reports";
import { fmtMoney } from "@/lib/format";
import { downloadCSV } from "@/lib/csv";
import { ReportToolbar, PageHeader, type ReportFilters } from "@/components/ReportToolbar";
import { Spinner, Badge } from "@/components/ui";
import { REPORT_CATEGORY_LABEL } from "@/lib/types";

export default function TrialBalancePage() {
  const { entity } = useEntity();
  const { rows, loading } = useLedger(entity?.id ?? null);
  const { projects } = useProjects(entity?.id ?? null);
  const [filters, setFilters] = useState<ReportFilters>({ from: "", to: "", projectId: "" });

  const tb = useMemo(() => {
    const f = filterRows(
      rows,
      { from: filters.from || undefined, to: filters.to || undefined },
      filters.projectId || undefined
    );
    return trialBalance(f);
  }, [rows, filters]);

  const diff = tb.totalDebit - tb.totalCredit;
  const balanced = Math.abs(diff) < 0.5;

  function handleExport() {
    if (!entity) return;
    const out = tb.rows.map((r) => [
      r.account_code,
      r.account_name,
      r.report_category ? REPORT_CATEGORY_LABEL[r.report_category] : "—",
      r.debit,
      r.credit,
      r.balance,
    ]);
    out.push(["", "الإجمالي", "", tb.totalDebit, tb.totalCredit, tb.totalDebit - tb.totalCredit]);
    downloadCSV(
      "trial-balance",
      ["كود الحساب", "اسم الحساب", "التصنيف", "مدين", "دائن", "الرصيد"],
      out
    );
  }

  if (!entity) {
    return <div className="p-6 text-center text-slate-500">الرجاء اختيار منشأة أولاً.</div>;
  }

  return (
    <div>
      <PageHeader title="ميزان المراجعة" subtitle={`عدد الحسابات: ${tb.rows.length}`} />
      <ReportToolbar
        filters={filters}
        setFilters={setFilters}
        projects={projects}
        onExport={handleExport}
      />

      {loading ? (
        <Spinner />
      ) : tb.rows.length === 0 ? (
        <div className="py-12 text-center text-slate-400">لا توجد حركات مطابقة.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
          <table className="sheet">
            <thead>
              <tr>
                <th>كود الحساب</th>
                <th>اسم الحساب</th>
                <th>التصنيف</th>
                <th>مدين</th>
                <th>دائن</th>
                <th>الرصيد</th>
              </tr>
            </thead>
            <tbody>
              {tb.rows.map((r) => (
                <tr key={r.account_id}>
                  <td className="num">{r.account_code}</td>
                  <td>{r.account_name}</td>
                  <td>{r.report_category ? REPORT_CATEGORY_LABEL[r.report_category] : "—"}</td>
                  <td>
                    <span className="num">{r.debit ? fmtMoney(r.debit, entity.currency) : ""}</span>
                  </td>
                  <td>
                    <span className="num">{r.credit ? fmtMoney(r.credit, entity.currency) : ""}</span>
                  </td>
                  <td>
                    <span className="num">{fmtMoney(r.balance, entity.currency)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-bold">
                <td colSpan={3}>الإجمالي</td>
                <td>
                  <span className="num">{fmtMoney(tb.totalDebit, entity.currency)}</span>
                </td>
                <td>
                  <span className="num">{fmtMoney(tb.totalCredit, entity.currency)}</span>
                </td>
                <td>
                  {balanced ? (
                    <Badge color="green">متوازن ✓</Badge>
                  ) : (
                    <Badge color="red">
                      فرق: <span className="num">{fmtMoney(diff, entity.currency)}</span>
                    </Badge>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
