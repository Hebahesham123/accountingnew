"use client";

import { useMemo, useState } from "react";
import { useEntity } from "@/components/EntityContext";
import { useProjects, useLedger } from "@/lib/data";
import { projectSummary, type ProjectSummary } from "@/lib/reports";
import { supabaseBrowser } from "@/lib/supabase/client";
import { fmtMoney } from "@/lib/format";
import { Button, Input, Select, Card, Modal, Field, Badge, Spinner } from "@/components/ui";
import { PageHeader } from "@/components/ReportToolbar";
import type { Project } from "@/lib/types";

interface FormState {
  name: string;
  code: string;
  status: "active" | "closed";
  budget: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  code: "",
  status: "active",
  budget: "",
  notes: "",
};

export default function ProjectsPage() {
  const { entity } = useEntity();
  const entityId = entity?.id ?? null;
  const { projects, loading: projectsLoading, reload } = useProjects(entityId);
  const { rows, loading: ledgerLoading } = useLedger(entityId);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // spend per project, keyed by project_id
  const summaryByProject = useMemo(() => {
    const map = new Map<string, ProjectSummary>();
    for (const s of projectSummary(rows)) {
      if (s.project_id) map.set(s.project_id, s);
    }
    return map;
  }, [rows]);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError(null);
    setModalOpen(true);
  }

  function openEdit(p: Project) {
    setEditing(p);
    setForm({
      name: p.name,
      code: p.code ?? "",
      status: p.status,
      budget: p.budget != null ? String(p.budget) : "",
      notes: p.notes ?? "",
    });
    setError(null);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!entityId) return;
    const name = form.name.trim();
    if (!name) {
      setError("اسم المشروع مطلوب");
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      entity_id: entityId,
      name,
      code: form.code.trim() || null,
      status: form.status,
      budget: form.budget.trim() === "" ? null : Number(form.budget),
      notes: form.notes.trim() || null,
    };

    const sb = supabaseBrowser();
    const { error: dbErr } = editing
      ? await sb.from("projects").update(payload).eq("id", editing.id)
      : await sb.from("projects").insert(payload);

    if (dbErr) {
      if (dbErr.code === "23505" || /duplicate|unique/i.test(dbErr.message)) {
        setError("اسم المشروع مستخدم");
      } else {
        setError(dbErr.message);
      }
      setSaving(false);
      return;
    }

    await reload();
    setSaving(false);
    setModalOpen(false);
  }

  async function handleDelete(p: Project) {
    if (!window.confirm(`هل تريد حذف المشروع "${p.name}"؟`)) return;
    const sb = supabaseBrowser();
    const { error: dbErr } = await sb.from("projects").delete().eq("id", p.id);
    if (dbErr) {
      window.alert(`تعذّر الحذف: ${dbErr.message}`);
      return;
    }
    await reload();
  }

  if (!entity) {
    return (
      <div>
        <PageHeader title="المشاريع" />
        <Card>
          <p className="py-8 text-center text-sm text-slate-500">
            الرجاء اختيار منشأة لعرض المشاريع.
          </p>
        </Card>
      </div>
    );
  }

  const loading = projectsLoading || ledgerLoading;

  return (
    <div dir="rtl">
      <PageHeader title="المشاريع" subtitle="إدارة المشاريع ومتابعة الإنفاق مقابل الموازنة">
        <Button onClick={openAdd}>+ إضافة مشروع</Button>
      </PageHeader>

      <Card>
        {loading ? (
          <Spinner />
        ) : projects.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">لا توجد مشاريع بعد.</p>
        ) : (
          <div className="overflow-auto">
            <table className="sheet">
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>الكود</th>
                  <th>الحالة</th>
                  <th>الموازنة</th>
                  <th>الإيرادات</th>
                  <th>المصروفات</th>
                  <th>الصافي</th>
                  <th>نسبة الإنفاق من الموازنة</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => {
                  const s = summaryByProject.get(p.id);
                  const revenue = s?.revenue ?? 0;
                  const expense = s?.expense ?? 0;
                  const net = s?.net ?? 0;
                  const hasBudget = p.budget != null && p.budget > 0;
                  const pct = hasBudget ? (expense / (p.budget as number)) * 100 : 0;
                  const pctClamped = Math.max(0, Math.min(100, pct));
                  const barColor =
                    pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500";
                  return (
                    <tr key={p.id}>
                      <td className="font-semibold text-slate-700">{p.name}</td>
                      <td>{p.code || "—"}</td>
                      <td>
                        {p.status === "active" ? (
                          <Badge color="green">نشط</Badge>
                        ) : (
                          <Badge color="slate">مغلق</Badge>
                        )}
                      </td>
                      <td className="num">
                        {hasBudget ? <span className="num">{fmtMoney(p.budget as number)}</span> : "—"}
                      </td>
                      <td className="num">
                        <span className="num">{fmtMoney(revenue)}</span>
                      </td>
                      <td className="num">
                        <span className="num">{fmtMoney(expense)}</span>
                      </td>
                      <td className="num">
                        <span className={`num ${net < 0 ? "text-red-600" : "text-emerald-600"}`}>
                          {fmtMoney(net)}
                        </span>
                      </td>
                      <td>
                        {hasBudget ? (
                          <div className="flex items-center gap-2" style={{ minWidth: 140 }}>
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className={`h-full rounded-full ${barColor}`}
                                style={{ width: `${pctClamped}%` }}
                              />
                            </div>
                            <span className="num text-xs text-slate-600">{pct.toFixed(0)}%</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td>
                        <div className="flex gap-1">
                          <Button variant="ghost" onClick={() => openEdit(p)}>
                            تعديل
                          </Button>
                          <Button variant="ghost" className="text-red-600" onClick={() => handleDelete(p)}>
                            حذف
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "تعديل مشروع" : "إضافة مشروع"}
      >
        <div className="space-y-4">
          <Field label="اسم المشروع *">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="اسم المشروع"
              autoFocus
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="الكود">
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="اختياري"
              />
            </Field>
            <Field label="الحالة">
              <Select
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as "active" | "closed" })
                }
              >
                <option value="active">نشط</option>
                <option value="closed">مغلق</option>
              </Select>
            </Field>
          </div>

          <Field label="الموازنة">
            <Input
              type="number"
              step="0.01"
              value={form.budget}
              onChange={(e) => setForm({ ...form, budget: e.target.value })}
              placeholder="0.00"
              dir="ltr"
            />
          </Field>

          <Field label="ملاحظات">
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              placeholder="ملاحظات اختيارية"
            />
          </Field>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              إلغاء
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "جارٍ الحفظ…" : "حفظ"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
