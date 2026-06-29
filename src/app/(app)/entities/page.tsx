"use client";
import React, { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useEntity } from "@/components/EntityContext";
import { Button, Input, Select, Card, Modal, Field, Badge, Spinner } from "@/components/ui";
import { PageHeader } from "@/components/ReportToolbar";
import { fmtDate } from "@/lib/format";
import type { Entity } from "@/lib/types";

interface FormState {
  name: string;
  legal_name: string;
  currency: string;
  notes: string;
  logo_url: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  legal_name: "",
  currency: "EGP",
  notes: "",
  logo_url: "",
};

export default function EntitiesPage() {
  const { entities, entity, setEntityId, profile, loading, reloadEntities } = useEntity();
  const isAdmin = profile?.role === "admin";

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Entity | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError(null);
    setModalOpen(true);
  }

  function openEdit(e: Entity) {
    setEditing(e);
    setForm({
      name: e.name ?? "",
      legal_name: e.legal_name ?? "",
      currency: e.currency ?? "EGP",
      notes: e.notes ?? "",
      logo_url: e.logo_url ?? "",
    });
    setError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    setError(null);
  }

  async function handleFile(file: File | null) {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const sb = supabaseBrowser();
      const path = `logos/${crypto.randomUUID()}-${file.name}`;
      const { error: upErr } = await sb.storage
        .from("entity-images")
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = sb.storage.from("entity-images").getPublicUrl(path);
      setForm((f) => ({ ...f, logo_url: data.publicUrl }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل رفع الصورة");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!form.name.trim()) {
      setError("اسم الكيان مطلوب");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const sb = supabaseBrowser();
      const payload = {
        name: form.name.trim(),
        legal_name: form.legal_name.trim() || null,
        currency: form.currency.trim() || "EGP",
        notes: form.notes.trim() || null,
        logo_url: form.logo_url || null,
      };
      if (editing) {
        const { error: upErr } = await sb.from("entities").update(payload).eq("id", editing.id);
        if (upErr) throw upErr;
      } else {
        const { error: insErr } = await sb.from("entities").insert(payload);
        if (insErr) throw insErr;
      }
      await reloadEntities();
      closeModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ أثناء الحفظ");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(e: Entity) {
    if (!window.confirm("سيتم حذف الكيان وكل بياناته. متأكد؟")) return;
    try {
      const sb = supabaseBrowser();
      const { error: delErr } = await sb.from("entities").delete().eq("id", e.id);
      if (delErr) throw delErr;
      await reloadEntities();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "تعذّر حذف الكيان");
    }
  }

  if (loading) {
    return (
      <div dir="rtl">
        <Spinner />
      </div>
    );
  }

  return (
    <div dir="rtl">
      <PageHeader title="الكيانات / الشركات">
        <Button onClick={openAdd}>+ إضافة كيان</Button>
      </PageHeader>

      {entities.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center gap-4 py-12 text-center text-slate-500">
            <p className="text-base font-semibold text-slate-600">لا توجد كيانات بعد</p>
            <p className="text-sm">ابدأ بإضافة أول كيان / شركة لإدارة حساباتها.</p>
            <Button onClick={openAdd}>+ إضافة كيان</Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {entities.map((e) => {
            const isCurrent = entity?.id === e.id;
            return (
              <div
                key={e.id}
                className={`rounded-xl border bg-white p-4 shadow-sm transition ${
                  isCurrent ? "border-brand-300 ring-2 ring-brand-400" : "border-slate-200"
                }`}
              >
                <div className="flex items-start gap-3">
                  {e.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={e.logo_url}
                      alt={e.name}
                      className="h-14 w-14 shrink-0 rounded-full border border-slate-200 object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xl font-bold text-brand-700">
                      {e.name?.charAt(0) ?? "?"}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-base font-bold text-slate-800">{e.name}</h3>
                      {isCurrent && <Badge color="blue">الكيان الحالي</Badge>}
                    </div>
                    {e.legal_name && (
                      <p className="truncate text-sm text-slate-500">{e.legal_name}</p>
                    )}
                    <div className="mt-1 flex items-center gap-2">
                      <Badge color="slate">{e.currency}</Badge>
                      {e.created_at && (
                        <span className="text-xs text-slate-400">{fmtDate(e.created_at)}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    variant={isCurrent ? "outline" : "primary"}
                    onClick={() => setEntityId(e.id)}
                    disabled={isCurrent}
                  >
                    تعيين كحالي
                  </Button>
                  <Button variant="outline" onClick={() => openEdit(e)}>
                    تعديل
                  </Button>
                  {isAdmin && (
                    <Button variant="danger" onClick={() => handleDelete(e)}>
                      حذف
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? "تعديل الكيان" : "إضافة كيان"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="اسم الكيان *">
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="اسم الكيان"
              required
            />
          </Field>

          <Field label="الاسم القانوني">
            <Input
              value={form.legal_name}
              onChange={(e) => setForm((f) => ({ ...f, legal_name: e.target.value }))}
              placeholder="الاسم القانوني (اختياري)"
            />
          </Field>

          <Field label="العملة">
            <Select
              value={form.currency}
              onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
            >
              <option value="EGP">EGP</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="SAR">SAR</option>
              <option value="AED">AED</option>
            </Select>
          </Field>

          <Field label="ملاحظات">
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
              placeholder="ملاحظات (اختياري)"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </Field>

          <Field label="شعار الكيان">
            <div className="flex items-center gap-3">
              {form.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.logo_url}
                  alt="شعار"
                  className="h-14 w-14 shrink-0 rounded-full border border-slate-200 object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  ?
                </div>
              )}
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                disabled={uploading}
              />
            </div>
            {uploading && <p className="mt-1 text-xs text-slate-400">جارٍ رفع الصورة…</p>}
          </Field>

          {error && <p className="text-sm font-semibold text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={closeModal}>
              إلغاء
            </Button>
            <Button type="submit" disabled={saving || uploading}>
              {saving ? "جارٍ الحفظ…" : editing ? "حفظ التعديلات" : "إضافة"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
