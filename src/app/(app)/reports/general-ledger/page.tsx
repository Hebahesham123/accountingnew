"use client";
import { useMemo, useState } from "react";
import { useEntity } from "@/components/EntityContext";
import { useLedger, useProjects } from "@/lib/data";
import { filterRows, generalLedger } from "@/lib/reports";
import { fmtMoney, fmtDate } from "@/lib/format";
import { downloadCSV } from "@/lib/csv";
import { ReportToolbar, PageHeader, type ReportFilters } from "@/components/ReportToolbar";
import { Spinner, Input, Badge } from "@/components/ui";

export default function GeneralLedgerPage() {
  const { entity } = useEntity();
  const { rows, loading } = useLedger(entity?.id ?? null);
  const { projects } = useProjects(entity?.id ?? null);
  const [filters, setFilters] = useState<ReportFilters>({ from: "", to: "", projectId: "" });
  const [accountQuery, setAccountQuery] = useState("");

  const accounts = useMemo(() => {
    const f = filterRows(
      rows,
      { from: filters.from || undefined, to: filters.to || undefined },
      filters.projectId || undefined
    );
    const all = generalLedger(f);
    const q = accountQuery.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (a) =>
        a.account_code.toLowerCase().includes(q) || a.account_name.toLowerCase().includes(q)
    );
  }, [rows, filters, accountQuery]);

  function handleExport() {
    if (!entity) return;
    const out: (string | number)[][] = [];
    for (const a of accounts) {
      for (const l of a.lines) {
        out.push([
          a.account_code,
          a.account_name,
          fmtDate(l.date),
          l.entry_no,
          l.line_description || l.entry_description || "",
          l.project_name || "",
          l.debit,
          l.credit,
          l.running,
        ]);
      }
    }
    downloadCSV(
      "general-ledger",
      ["كود الحساب", "اسم الحساب", "التاريخ", "رقم القيد", "البيان", "المشروع", "مدين", "دائن", "الرصيد الجاري"],
      out
    );
  }

  if (!entity) {
    return <div className="p-6 text-center text-slate-500">الرجاء اختيار منشأة أولاً.</div>;
  }

  return (
    <div>
      <PageHeader title="دفتر الأستاذ" subtitle={`عدد الحسابات المعروضة: ${accounts.length}`} />
      <ReportToolbar
        filters={filters}
        setFilters={setFilters}
        projects={projects}
        onExport={handleExport}
      />

      <div className="no-print mb-4 max-w-sm">
        <Input
          placeholder="بحث عن حساب بالكود أو الاسم…"
          value={accountQuery}
          onChange={(e) => setAccountQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <Spinner />
      ) : accounts.length === 0 ? (
        <div className="py-12 text-center text-slate-400">لا توجد حركات مطابقة.</div>
      ) : (
        <div className="space-y-6">
          {accounts.map((a) => (
            <div
              key={a.account_id}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-slate-400">{a.account_code}</span>
                  <span className="text-sm font-bold text-slate-700">{a.account_name}</span>
                </div>
                <Badge color={a.balance >= 0 ? "blue" : "amber"}>
                  الرصيد: <span className="num">{fmtMoney(a.balance, entity.currency)}</span>
                </Badge>
              </div>
              <div className="overflow-x-auto p-2">
                <table className="sheet">
                  <thead>
                    <tr>
                      <th>التاريخ</th>
                      <th>رقم القيد</th>
                      <th>البيان</th>
                      <th>المشروع</th>
                      <th>مدين</th>
                      <th>دائن</th>
                      <th>الرصيد الجاري</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.lines.map((l, i) => (
                      <tr key={`${l.entry_id}-${i}`}>
                        <td className="num">{fmtDate(l.date)}</td>
                        <td className="num">{l.entry_no}</td>
                        <td>{l.line_description || l.entry_description || "—"}</td>
                        <td>{l.project_name || "—"}</td>
                        <td>
                          <span className="num">{l.debit ? fmtMoney(l.debit, entity.currency) : ""}</span>
                        </td>
                        <td>
                          <span className="num">{l.credit ? fmtMoney(l.credit, entity.currency) : ""}</span>
                        </td>
                        <td>
                          <span className="num">{fmtMoney(l.running, entity.currency)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-bold">
                      <td colSpan={4}>الإجمالي</td>
                      <td>
                        <span className="num">{fmtMoney(a.totalDebit, entity.currency)}</span>
                      </td>
                      <td>
                        <span className="num">{fmtMoney(a.totalCredit, entity.currency)}</span>
                      </td>
                      <td>
                        <span className="num">{fmtMoney(a.balance, entity.currency)}</span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
