"use client";
import { useMemo, useState } from "react";
import { useEntity } from "@/components/EntityContext";
import { useLedger, useProjects } from "@/lib/data";
import { filterRows } from "@/lib/reports";
import { fmtMoney, fmtDate } from "@/lib/format";
import { downloadCSV } from "@/lib/csv";
import { ReportToolbar, PageHeader, type ReportFilters } from "@/components/ReportToolbar";
import { Spinner, Select, Card } from "@/components/ui";
import type { LedgerRow } from "@/lib/types";

export default function AccountReportsPage() {
  const { entity } = useEntity();
  const { rows, loading } = useLedger(entity?.id ?? null);
  const { projects } = useProjects(entity?.id ?? null);
  const [filters, setFilters] = useState<ReportFilters>({ from: "", to: "", projectId: "" });
  const [accountId, setAccountId] = useState("");

  // distinct accounts derived from ledger rows
  const accountOptions = useMemo(() => {
    const map = new Map<string, { id: string; code: string; name: string }>();
    for (const r of rows) {
      if (!map.has(r.account_id)) {
        map.set(r.account_id, { id: r.account_id, code: r.account_code, name: r.account_name });
      }
    }
    return [...map.values()].sort((a, b) =>
      a.code.localeCompare(b.code, undefined, { numeric: true })
    );
  }, [rows]);

  const statement = useMemo(() => {
    if (!accountId) return null;
    const f = filterRows(
      rows,
      { from: filters.from || undefined, to: filters.to || undefined },
      filters.projectId || undefined
    ).filter((r) => r.account_id === accountId);
    const sorted = [...f].sort(
      (a, b) => a.date.localeCompare(b.date) || a.entry_no - b.entry_no
    );
    let running = 0;
    let totalDebit = 0;
    let totalCredit = 0;
    const lines: (LedgerRow & { running: number })[] = [];
    for (const r of sorted) {
      running += r.debit - r.credit;
      totalDebit += r.debit;
      totalCredit += r.credit;
      lines.push({ ...r, running });
    }
    const meta = accountOptions.find((a) => a.id === accountId);
    return { lines, totalDebit, totalCredit, balance: running, meta };
  }, [accountId, rows, filters, accountOptions]);

  function handleExport() {
    if (!entity || !statement) return;
    const out = statement.lines.map((l) => [
      fmtDate(l.date),
      l.entry_no,
      l.line_description || l.entry_description || "",
      l.project_name || "",
      l.debit,
      l.credit,
      l.running,
    ]);
    const name = statement.meta ? `${statement.meta.code}-${statement.meta.name}` : "account";
    downloadCSV(
      `account-statement-${name}`,
      ["التاريخ", "رقم القيد", "البيان", "المشروع", "مدين", "دائن", "الرصيد الجاري"],
      out
    );
  }

  if (!entity) {
    return <div className="p-6 text-center text-slate-500">الرجاء اختيار منشأة أولاً.</div>;
  }

  return (
    <div>
      <PageHeader title="تقارير الحسابات" subtitle="كشف حساب تفصيلي لحساب واحد" />

      <div className="no-print mb-4 max-w-md">
        <span className="mb-1 block text-xs font-semibold text-slate-500">اختر الحساب</span>
        <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">— اختر حساباً —</option>
          {accountOptions.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code} — {a.name}
            </option>
          ))}
        </Select>
      </div>

      <ReportToolbar
        filters={filters}
        setFilters={setFilters}
        projects={projects}
        onExport={handleExport}
        showProject={true}
      />

      {loading ? (
        <Spinner />
      ) : !accountId || !statement ? (
        <div className="py-12 text-center text-slate-400">اختر حساباً لعرض كشف الحساب.</div>
      ) : (
        <div>
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card>
              <div className="text-xs font-semibold text-slate-500">إجمالي المدين</div>
              <div className="mt-1 text-lg font-bold text-slate-800">
                <span className="num">{fmtMoney(statement.totalDebit, entity.currency)}</span>
              </div>
            </Card>
            <Card>
              <div className="text-xs font-semibold text-slate-500">إجمالي الدائن</div>
              <div className="mt-1 text-lg font-bold text-slate-800">
                <span className="num">{fmtMoney(statement.totalCredit, entity.currency)}</span>
              </div>
            </Card>
            <Card>
              <div className="text-xs font-semibold text-slate-500">الرصيد</div>
              <div className="mt-1 text-lg font-bold text-slate-800">
                <span className="num">{fmtMoney(statement.balance, entity.currency)}</span>
              </div>
            </Card>
          </div>

          {statement.lines.length === 0 ? (
            <div className="py-12 text-center text-slate-400">لا توجد حركات في الفترة المحددة.</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
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
                  {statement.lines.map((l, i) => (
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
                      <span className="num">{fmtMoney(statement.totalDebit, entity.currency)}</span>
                    </td>
                    <td>
                      <span className="num">{fmtMoney(statement.totalCredit, entity.currency)}</span>
                    </td>
                    <td>
                      <span className="num">{fmtMoney(statement.balance, entity.currency)}</span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
