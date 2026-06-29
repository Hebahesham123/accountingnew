"use client";
import { useMemo, useState } from "react";
import { useEntity } from "@/components/EntityContext";
import { useAccounts } from "@/lib/data";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Button, Input, Select, Card, Modal, Field, Badge, Spinner } from "@/components/ui";
import { PageHeader } from "@/components/ReportToolbar";
import {
  REPORT_CATEGORY_LABEL,
  type Account,
  type AccountType,
  type ReportCategory,
} from "@/lib/types";

const TYPE_LABEL: Record<AccountType, string> = {
  account: "حساب",
  group: "مجموعة",
  category: "تصنيف رئيسي",
};

const TYPE_ICON: Record<AccountType, string> = {
  category: "📁",
  group: "🗂",
  account: "📄",
};

const CATEGORY_COLOR: Record<ReportCategory, string> = {
  asset: "blue",
  liability: "amber",
  equity: "green",
  income: "green",
  expense: "red",
};

interface TreeNode extends Account {
  children: TreeNode[];
}

interface FormState {
  code: string;
  name: string;
  type: AccountType;
  report_category: ReportCategory | "";
  is_postable: boolean;
}

function isPgError(e: unknown): e is { code?: string; message?: string } {
  return typeof e === "object" && e !== null;
}

export default function AccountsPage() {
  const { entity } = useEntity();
  const { accounts, loading, reload } = useAccounts(entity?.id ?? null);

  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [editTarget, setEditTarget] = useState<Account | null>(null);
  const [parentNode, setParentNode] = useState<Account | null>(null);
  const [form, setForm] = useState<FormState>({
    code: "",
    name: "",
    type: "account",
    report_category: "",
    is_postable: true,
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Build tree
  const { roots, childMap } = useMemo(() => {
    const byParent = new Map<string | null, TreeNode[]>();
    const nodes = new Map<string, TreeNode>();
    for (const a of accounts) nodes.set(a.id, { ...a, children: [] });
    for (const n of nodes.values()) {
      const key = n.parent_id;
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key)!.push(n);
    }
    // attach children
    for (const n of nodes.values()) {
      n.children = byParent.get(n.id) ?? [];
    }
    const sortFn = (a: TreeNode, b: TreeNode) =>
      (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.code.localeCompare(b.code);
    for (const arr of byParent.values()) arr.sort(sortFn);
    const cmap = new Map<string, TreeNode[]>();
    for (const n of nodes.values()) cmap.set(n.id, n.children);
    return { roots: (byParent.get(null) ?? []).slice().sort(sortFn), childMap: cmap };
  }, [accounts]);

  // Search: find matching nodes and their ancestors
  const { matchedIds, visibleIds, forceExpanded } = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return {
        matchedIds: null as Set<string> | null,
        visibleIds: null as Set<string> | null,
        forceExpanded: null as Set<string> | null,
      };
    }
    const parentById = new Map<string, string | null>();
    for (const a of accounts) parentById.set(a.id, a.parent_id);
    const matched = new Set<string>();
    for (const a of accounts) {
      if (a.code.toLowerCase().includes(term) || a.name.toLowerCase().includes(term)) {
        matched.add(a.id);
      }
    }
    const visible = new Set<string>();
    const expand = new Set<string>();
    for (const id of matched) {
      visible.add(id);
      let p = parentById.get(id) ?? null;
      while (p) {
        visible.add(p);
        expand.add(p);
        p = parentById.get(p) ?? null;
      }
    }
    return { matchedIds: matched, visibleIds: visible, forceExpanded: expand };
  }, [search, accounts]);

  function toggle(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openAddRoot() {
    setModalMode("add");
    setEditTarget(null);
    setParentNode(null);
    setForm({ code: "", name: "", type: "category", report_category: "", is_postable: false });
    setFormError(null);
    setModalOpen(true);
  }

  function openAddChild(node: Account) {
    setModalMode("add");
    setEditTarget(null);
    setParentNode(node);
    const childType: AccountType = node.type === "category" ? "group" : "account";
    setForm({
      code: "",
      name: "",
      type: childType,
      report_category: node.report_category ?? "",
      is_postable: childType === "account",
    });
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(node: Account) {
    setModalMode("edit");
    setEditTarget(node);
    setParentNode(null);
    setForm({
      code: node.code,
      name: node.name,
      type: node.type,
      report_category: node.report_category ?? "",
      is_postable: node.is_postable,
    });
    setFormError(null);
    setModalOpen(true);
  }

  async function handleDelete(node: Account) {
    const children = childMap.get(node.id) ?? [];
    if (children.length > 0) {
      window.alert("احذف الفروع أولاً");
      return;
    }
    if (!window.confirm(`هل تريد حذف الحساب "${node.name}"؟`)) return;
    const { error } = await supabaseBrowser().from("accounts").delete().eq("id", node.id);
    if (error) {
      if (isPgError(error) && error.code === "23503") {
        window.alert("لا يمكن الحذف: الحساب مستخدم في قيود");
      } else {
        window.alert("تعذر الحذف: " + (isPgError(error) ? error.message : ""));
      }
      return;
    }
    await reload();
  }

  async function handleSubmit() {
    if (!entity) return;
    const code = form.code.trim();
    const name = form.name.trim();
    if (!code) {
      setFormError("الكود مطلوب");
      return;
    }
    if (!name) {
      setFormError("الاسم مطلوب");
      return;
    }
    setSaving(true);
    setFormError(null);

    const reportCategory: ReportCategory | null = form.report_category || null;

    // Derive inherited names
    let category_name: string | null = null;
    let group_name: string | null = null;
    if (modalMode === "add") {
      if (parentNode) {
        if (parentNode.type === "category") {
          category_name = parentNode.name;
        } else if (parentNode.type === "group") {
          category_name = parentNode.category_name ?? null;
          group_name = parentNode.name;
        }
      } else {
        // top-level category
        category_name = name;
      }
    }

    try {
      if (modalMode === "edit" && editTarget) {
        const { error } = await supabaseBrowser()
          .from("accounts")
          .update({
            code,
            name,
            type: form.type,
            report_category: reportCategory,
            is_postable: form.is_postable,
          })
          .eq("id", editTarget.id);
        if (error) throw error;
      } else {
        const { error } = await supabaseBrowser()
          .from("accounts")
          .insert({
            entity_id: entity.id,
            code,
            name,
            type: form.type,
            report_category: reportCategory,
            parent_id: parentNode?.id ?? null,
            category_name,
            group_name,
            is_postable: form.is_postable,
          });
        if (error) throw error;
      }
      setModalOpen(false);
      await reload();
    } catch (e) {
      if (isPgError(e) && e.code === "23505") {
        setFormError("الكود مستخدم");
      } else {
        setFormError("تعذر الحفظ: " + (isPgError(e) ? e.message ?? "" : ""));
      }
    } finally {
      setSaving(false);
    }
  }

  function renderNode(node: TreeNode, depth: number): React.ReactNode {
    if (visibleIds && !visibleIds.has(node.id)) return null;
    const children = node.children;
    const hasChildren = children.length > 0;
    const isExpanded = forceExpanded?.has(node.id) ? true : !collapsed.has(node.id);
    const isMatch = matchedIds?.has(node.id);

    return (
      <div key={node.id}>
        <div
          className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
          style={{ paddingInlineStart: depth * 20 + 8 }}
        >
          <button
            type="button"
            onClick={() => hasChildren && toggle(node.id)}
            className={`flex h-5 w-5 shrink-0 items-center justify-center text-slate-400 ${
              hasChildren ? "hover:text-slate-700" : "invisible"
            }`}
            aria-label="توسيع"
          >
            {hasChildren ? (isExpanded ? "▾" : "◂") : ""}
          </button>
          <span className="shrink-0">{TYPE_ICON[node.type]}</span>
          <span className="font-mono text-xs text-slate-400">{node.code}</span>
          <span
            className={`text-sm ${node.is_postable ? "text-slate-800" : "text-slate-500"} ${
              isMatch ? "font-bold text-brand-700" : ""
            }`}
          >
            {node.name}
          </span>
          {!node.is_postable && node.type === "account" && (
            <span className="text-[10px] text-slate-300">(غير قابل للترحيل)</span>
          )}
          {node.type === "category" && node.report_category && (
            <Badge color={CATEGORY_COLOR[node.report_category]}>
              {REPORT_CATEGORY_LABEL[node.report_category]}
            </Badge>
          )}

          <div className="ms-auto flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
            {node.type !== "account" && (
              <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => openAddChild(node)}>
                ＋ إضافة فرع
              </Button>
            )}
            <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => openEdit(node)}>
              ✎ تعديل
            </Button>
            <Button variant="ghost" className="px-2 py-1 text-xs text-red-600" onClick={() => handleDelete(node)}>
              🗑 حذف
            </Button>
          </div>
        </div>
        {hasChildren && isExpanded && <div>{children.map((c) => renderNode(c, depth + 1))}</div>}
      </div>
    );
  }

  if (!entity) {
    return (
      <div className="p-6 text-center text-slate-500">الرجاء اختيار منشأة أولاً.</div>
    );
  }

  return (
    <div>
      <PageHeader title="شجرة الحسابات" subtitle={`إجمالي الحسابات: ${accounts.length}`}>
        <Button onClick={openAddRoot}>＋ إضافة حساب رئيسي</Button>
      </PageHeader>

      <div className="mb-4 max-w-sm">
        <Input
          placeholder="بحث بالكود أو الاسم…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        {loading ? (
          <Spinner />
        ) : roots.length === 0 ? (
          <div className="py-12 text-center text-slate-400">لا توجد حسابات بعد.</div>
        ) : visibleIds && visibleIds.size === 0 ? (
          <div className="py-12 text-center text-slate-400">لا توجد نتائج مطابقة.</div>
        ) : (
          <div>{roots.map((r) => renderNode(r, 0))}</div>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          modalMode === "edit"
            ? "تعديل حساب"
            : parentNode
            ? `إضافة فرع تحت: ${parentNode.name}`
            : "إضافة حساب رئيسي"
        }
      >
        <div className="space-y-4">
          <Field label="الكود">
            <Input
              value={form.code}
              dir="ltr"
              className="font-mono"
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
          </Field>
          <Field label="الاسم">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="النوع">
            <Select
              value={form.type}
              onChange={(e) =>
                setForm({
                  ...form,
                  type: e.target.value as AccountType,
                  is_postable: e.target.value === "account",
                })
              }
            >
              <option value="account">{TYPE_LABEL.account}</option>
              <option value="group">{TYPE_LABEL.group}</option>
              <option value="category">{TYPE_LABEL.category}</option>
            </Select>
          </Field>
          <Field label="التصنيف للتقارير">
            <Select
              value={form.report_category}
              onChange={(e) =>
                setForm({ ...form, report_category: e.target.value as ReportCategory | "" })
              }
            >
              <option value="">بدون</option>
              {(Object.keys(REPORT_CATEGORY_LABEL) as ReportCategory[]).map((k) => (
                <option key={k} value={k}>
                  {REPORT_CATEGORY_LABEL[k]}
                </option>
              ))}
            </Select>
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.is_postable}
              onChange={(e) => setForm({ ...form, is_postable: e.target.checked })}
              className="h-4 w-4"
            />
            قابل للترحيل (يمكن استخدامه في القيود)
          </label>

          {formError && <p className="text-sm font-semibold text-red-600">{formError}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              إلغاء
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "جارٍ الحفظ…" : "حفظ"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
