"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useEntity } from "@/components/EntityContext";
import { useAccounts, useProjects } from "@/lib/data";
import { supabaseBrowser } from "@/lib/supabase/client";
import { fmtMoney, todayISO } from "@/lib/format";
import { Button, Input, Select, Card, Field, Badge, Spinner } from "@/components/ui";
import type { JournalEntry, JournalLine } from "@/lib/types";

interface LineState {
  account_id: string;
  project_id: string;
  debit: string;
  credit: string;
  description: string;
}

const EMPTY_LINE: LineState = {
  account_id: "",
  project_id: "",
  debit: "",
  credit: "",
  description: "",
};

function num(v: string): number {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

export default function JournalEntryForm({ entryId }: { entryId?: string }) {
  const router = useRouter();
  const { entity } = useEntity();
  const entityId = entity?.id ?? null;
  const currency = entity?.currency ?? "EGP";
  const { accounts, loading: accountsLoading } = useAccounts(entityId);
  const { projects, loading: projectsLoading } = useProjects(entityId);

  const [date, setDate] = useState<string>(todayISO());
  const [description, setDescription] = useState("");
  const [refNo, setRefNo] = useState("");
  const [lines, setLines] = useState<LineState[]>([{ ...EMPTY_LINE }, { ...EMPTY_LINE }]);

  const [loadingEntry, setLoadingEntry] = useState<boolean>(!!entryId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const postableAccounts = useMemo(
    () => accounts.filter((a) => a.is_postable && a.type === "account"),
    [accounts]
  );

  // Load existing entry when editing
  useEffect(() => {
    if (!entryId) return;
    let cancelled = false;
    (async () => {
      setLoadingEntry(true);
      setError(null);
      const sb = supabaseBrowser();
      const { data: entry, error: entryErr } = await sb
        .from("journal_entries")
        .select("*")
        .eq("id", entryId)
        .single();
      if (cancelled) return;
      if (entryErr || !entry) {
        setError(entryErr?.message ?? "تعذّر تحميل القيد");
        setLoadingEntry(false);
        return;
      }
      const e = entry as JournalEntry;
      setDate(e.date?.slice(0, 10) ?? todayISO());
      setDescription(e.description ?? "");
      setRefNo(e.ref_no ?? "");

      const { data: lineRows, error: linesErr } = await sb
        .from("journal_lines")
        .select("*")
        .eq("entry_id", entryId)
        .order("line_no");
      if (cancelled) return;
      if (linesErr) {
        setError(linesErr.message);
        setLoadingEntry(false);
        return;
      }
      const ls = (lineRows as JournalLine[]) ?? [];
      setLines(
        ls.length
          ? ls.map((l) => ({
              account_id: l.account_id ?? "",
              project_id: l.project_id ?? "",
              debit: l.debit ? String(l.debit) : "",
              credit: l.credit ? String(l.credit) : "",
              description: l.description ?? "",
            }))
          : [{ ...EMPTY_LINE }, { ...EMPTY_LINE }]
      );
      setLoadingEntry(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [entryId]);

  function updateLine(idx: number, patch: Partial<LineState>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function setDebit(idx: number, value: string) {
    // typing a debit zeroes the credit
    updateLine(idx, { debit: value, credit: num(value) !== 0 ? "" : lines[idx].credit });
  }

  function setCredit(idx: number, value: string) {
    updateLine(idx, { credit: value, debit: num(value) !== 0 ? "" : lines[idx].debit });
  }

  function addLine() {
    setLines((prev) => [...prev, { ...EMPTY_LINE }]);
  }

  function removeLine(idx: number) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  }

  const totalDebit = useMemo(() => lines.reduce((s, l) => s + num(l.debit), 0), [lines]);
  const totalCredit = useMemo(() => lines.reduce((s, l) => s + num(l.credit), 0), [lines]);
  const diff = totalDebit - totalCredit;
  const balanced = Math.abs(diff) <= 0.005;

  // a "non-empty" line is one with an account or an amount
  const nonEmptyLines = useMemo(
    () => lines.filter((l) => l.account_id || num(l.debit) !== 0 || num(l.credit) !== 0),
    [lines]
  );
  const everyNonEmptyHasAccount = nonEmptyLines.every((l) => !!l.account_id);
  const hasTotal = totalDebit > 0 || totalCredit > 0;

  const canSave =
    !!entityId &&
    balanced &&
    hasTotal &&
    nonEmptyLines.length > 0 &&
    everyNonEmptyHasAccount &&
    !saving;

  async function handleSave() {
    if (!entityId || !canSave) return;
    setSaving(true);
    setError(null);
    const sb = supabaseBrowser();

    try {
      const payloadLines = nonEmptyLines.map((l, i) => ({
        account_id: l.account_id,
        project_id: l.project_id || null,
        debit: num(l.debit),
        credit: num(l.credit),
        description: l.description.trim() || null,
        line_no: i,
      }));

      if (entryId) {
        // Update header
        const { error: updErr } = await sb
          .from("journal_entries")
          .update({
            date,
            description: description.trim() || null,
            ref_no: refNo.trim() || null,
          })
          .eq("id", entryId);
        if (updErr) throw updErr;

        // Replace lines
        const { error: delErr } = await sb.from("journal_lines").delete().eq("entry_id", entryId);
        if (delErr) throw delErr;

        const { error: insErr } = await sb
          .from("journal_lines")
          .insert(payloadLines.map((l) => ({ ...l, entry_id: entryId })));
        if (insErr) throw insErr;
      } else {
        // Next entry number
        let entryNo: number | null = null;
        const { data: rpcData, error: rpcErr } = await sb.rpc("next_entry_no", {
          p_entity: entityId,
        });
        if (!rpcErr && rpcData != null) {
          entryNo = Number(rpcData);
        } else {
          // fallback: max + 1
          const { data: maxRow } = await sb
            .from("journal_entries")
            .select("entry_no")
            .eq("entity_id", entityId)
            .order("entry_no", { ascending: false })
            .limit(1)
            .maybeSingle();
          entryNo = ((maxRow as { entry_no: number } | null)?.entry_no ?? 0) + 1;
        }

        const { data: inserted, error: insHeadErr } = await sb
          .from("journal_entries")
          .insert({
            entity_id: entityId,
            entry_no: entryNo,
            date,
            description: description.trim() || null,
            ref_no: refNo.trim() || null,
          })
          .select("id")
          .single();
        if (insHeadErr) throw insHeadErr;

        const newId = (inserted as { id: string }).id;
        const { error: insLinesErr } = await sb
          .from("journal_lines")
          .insert(payloadLines.map((l) => ({ ...l, entry_id: newId })));
        if (insLinesErr) throw insLinesErr;
      }

      router.push("/journal");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  if (!entity) {
    return (
      <Card>
        <p className="py-8 text-center text-sm text-slate-500">الرجاء اختيار منشأة أولاً.</p>
      </Card>
    );
  }

  if (loadingEntry || accountsLoading || projectsLoading) {
    return <Spinner />;
  }

  return (
    <div dir="rtl" className="space-y-4">
      <Card>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field label="التاريخ">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} dir="ltr" />
          </Field>
          <Field label="المرجع">
            <Input
              value={refNo}
              onChange={(e) => setRefNo(e.target.value)}
              placeholder="اختياري"
            />
          </Field>
          <Field label="البيان">
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="وصف القيد"
            />
          </Field>
        </div>
      </Card>

      <Card title="سطور القيد">
        <div className="overflow-auto">
          <table className="sheet">
            <thead>
              <tr>
                <th style={{ minWidth: 220 }}>الحساب</th>
                <th style={{ minWidth: 140 }}>المشروع</th>
                <th style={{ minWidth: 120 }}>مدين</th>
                <th style={{ minWidth: 120 }}>دائن</th>
                <th style={{ minWidth: 160 }}>بيان</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, idx) => (
                <tr key={idx}>
                  <td>
                    <Select
                      value={l.account_id}
                      onChange={(e) => updateLine(idx, { account_id: e.target.value })}
                    >
                      <option value="">— اختر حساب —</option>
                      {postableAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} — {a.name}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td>
                    <Select
                      value={l.project_id}
                      onChange={(e) => updateLine(idx, { project_id: e.target.value })}
                    >
                      <option value="">—</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td>
                    <Input
                      type="number"
                      step="0.01"
                      dir="ltr"
                      value={l.debit}
                      onChange={(e) => setDebit(idx, e.target.value)}
                      placeholder="0.00"
                    />
                  </td>
                  <td>
                    <Input
                      type="number"
                      step="0.01"
                      dir="ltr"
                      value={l.credit}
                      onChange={(e) => setCredit(idx, e.target.value)}
                      placeholder="0.00"
                    />
                  </td>
                  <td>
                    <Input
                      value={l.description}
                      onChange={(e) => updateLine(idx, { description: e.target.value })}
                      placeholder="بيان السطر"
                    />
                  </td>
                  <td>
                    <Button
                      variant="ghost"
                      className="text-red-600"
                      onClick={() => removeLine(idx)}
                      disabled={lines.length <= 1}
                      type="button"
                    >
                      حذف
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td className="text-left" colSpan={2}>
                  الإجمالي
                </td>
                <td className="num">{fmtMoney(totalDebit, currency)}</td>
                <td className="num">{fmtMoney(totalCredit, currency)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <Button variant="outline" onClick={addLine} type="button">
            + إضافة سطر
          </Button>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600">
              الفرق: <span className="num font-semibold">{fmtMoney(diff, currency)}</span>
            </span>
            {hasTotal && balanced ? (
              <Badge color="green">متوازن ✓</Badge>
            ) : (
              <Badge color="red">غير متوازن</Badge>
            )}
          </div>
        </div>
      </Card>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">{error}</p>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.push("/journal")} disabled={saving} type="button">
          إلغاء
        </Button>
        <Button onClick={handleSave} disabled={!canSave} type="button">
          {saving ? "جارٍ الحفظ…" : "حفظ القيد"}
        </Button>
      </div>
    </div>
  );
}
