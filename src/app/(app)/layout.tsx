"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { EntityProvider, useEntity } from "@/components/EntityContext";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Select } from "@/components/ui";

const NAV = [
  { href: "/dashboard", label: "لوحة التحكم", icon: "📊" },
  { href: "/entities", label: "الكيانات / الشركات", icon: "🏢" },
  { href: "/accounts", label: "شجرة الحسابات", icon: "🌳" },
  { href: "/projects", label: "المشاريع", icon: "📁" },
  { href: "/journal", label: "قيود اليومية", icon: "📝" },
  { type: "sep", label: "التقارير المالية" },
  { href: "/reports/general-ledger", label: "دفتر الأستاذ", icon: "📒" },
  { href: "/reports/trial-balance", label: "ميزان المراجعة", icon: "⚖️" },
  { href: "/reports/balance-sheet", label: "الميزانية العمومية", icon: "🧾" },
  { href: "/reports/income-statement", label: "قائمة الدخل", icon: "💰" },
  { href: "/reports/cash-flow", label: "التدفقات النقدية", icon: "💵" },
  { href: "/reports/account-reports", label: "تقارير الحسابات", icon: "🔎" },
] as const;

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { entities, entity, setEntityId, profile } = useEntity();
  const sb = supabaseBrowser();

  async function signOut() {
    await sb.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen">
      <aside className="no-print sticky top-0 flex h-screen w-64 flex-col border-l border-slate-200 bg-white">
        <div className="flex items-center gap-2 border-b px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 font-bold text-white">
            ₪
          </div>
          <div className="font-bold text-slate-800">نظام المحاسبة</div>
        </div>
        <nav className="flex-1 space-y-1 overflow-auto p-3">
          {NAV.map((item, i) =>
            "type" in item ? (
              <div key={i} className="px-3 pb-1 pt-4 text-xs font-bold uppercase text-slate-400">
                {item.label}
              </div>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  pathname === item.href
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            )
          )}
        </nav>
        <div className="border-t p-3 text-xs text-slate-500">
          <div className="mb-2 truncate">
            {profile?.full_name ?? profile?.email}
            {profile?.role === "admin" && (
              <span className="mr-1 rounded bg-amber-100 px-1.5 py-0.5 text-amber-700">مدير</span>
            )}
          </div>
          <button onClick={signOut} className="text-red-600 hover:underline">
            تسجيل الخروج
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="no-print sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-200 bg-white/90 px-6 py-3 backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-500">الكيان الحالي:</span>
            <div className="w-64">
              <Select value={entity?.id ?? ""} onChange={(e) => setEntityId(e.target.value)}>
                {entities.length === 0 && <option value="">لا يوجد كيان — أضف واحداً</option>}
                {entities.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="text-sm text-slate-400">{entity?.currency ?? "EGP"}</div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <EntityProvider>
      <Shell>{children}</Shell>
    </EntityProvider>
  );
}
