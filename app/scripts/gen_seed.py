# -*- coding: utf-8 -*-
"""Generate supabase/seed.sql from the extracted JSON (../data/*.json)."""
import json, os, io

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # app/
DATA = os.path.join(os.path.dirname(ROOT), "data")                   # newaccounting/data
OUT  = os.path.join(ROOT, "supabase", "seed.sql")

ENTITY_ID = "11111111-1111-1111-1111-111111111111"
ENTITY_NAME = "الشركة الرئيسية"

def load(n): return json.load(open(os.path.join(DATA, n), encoding="utf-8"))
accounts = load("accounts.json")
projects = load("projects.json")
lines    = load("journal_lines.json")

def norm(s):
    return None if s is None else str(s).strip()

# ---- classification of a top-category name into a financial-statement bucket
def classify(cat):
    if not cat: return None
    c = cat.strip()
    if c.startswith("الايراد"):                              return "income"
    if c.startswith("مصروف") or c.startswith("تكاليف"):       return "expense"
    if c.startswith("ضريبة ارباح") or c.startswith("ضريبة أرباح"): return "expense"
    if c.startswith("حقوق الملكية") or "ارباح" in c or "احتياط" in c or "خسائر" in c:
        return "equity"
    if c.startswith("الدائن") or c.startswith("مخصص ضرائب"):   return "liability"
    if c.startswith("الاص") or c.startswith("الأص") or c.startswith("المدين") \
       or c.startswith("مجمع الاهلاك") or c.startswith("مخصص ديون"):
        return "asset"
    return None

def q(s):
    if s is None: return "null"
    return "'" + str(s).replace("'", "''") + "'"

def num(x):
    try: return str(round(float(x), 2))
    except Exception: return "0"

# ---- build the master account map (code -> record), tree first then journal gaps
acc = {}
for a in accounts:
    code = norm(a["code"])
    if code is None: continue
    acc[code] = {
        "code": code, "name": norm(a["name"]) or code,
        "group": norm(a.get("group")), "category": norm(a.get("category")),
    }
for l in lines:
    code = norm(l.get("account_code"))
    if code is None: continue
    if code not in acc:
        acc[code] = {
            "code": code, "name": norm(l.get("account_name")) or code,
            "group": norm(l.get("group")), "category": norm(l.get("category")),
        }

# normalize category/group text
for r in acc.values():
    r["category"] = (r["category"] or "غير مصنف").strip()
    r["group"] = (r["group"] or r["category"]).strip()
    r["report"] = classify(r["category"])

categories = []
seen_cat = set()
for r in acc.values():
    if r["category"] not in seen_cat:
        seen_cat.add(r["category"]); categories.append(r["category"])

group_pairs = []
seen_grp = set()
for r in acc.values():
    key = (r["category"], r["group"])
    if key not in seen_grp:
        seen_grp.add(key); group_pairs.append(key)

# ---- split journal rows into entries keyed by (entry_no, date)
entries = {}   # (entry_no,date) -> {ref, date, desc}
entry_seq = {}
seq = 0
jl = []        # (new_entry_no, code, project_name, debit, credit, desc)
for l in lines:
    code = norm(l.get("account_code"))
    if code is None: continue
    eno = l.get("entry_no")
    date = l.get("date")
    if date is None: continue
    key = (eno, date)
    if key not in entry_seq:
        seq += 1
        entry_seq[key] = seq
        desc = norm(l.get("description"))
        entries[seq] = {"ref": str(eno) if eno is not None else None, "date": date, "desc": desc}
    new_no = entry_seq[key]
    if entries[new_no]["desc"] is None and norm(l.get("description")):
        entries[new_no]["desc"] = norm(l.get("description"))
    proj = norm(l.get("project"))
    if proj and proj.startswith("رصيد اول مدة"):
        proj = None
    jl.append((new_no, code, proj, l.get("debit") or 0, l.get("credit") or 0, norm(l.get("description"))))

# ============================================================================
out = io.StringIO()
w = out.write
w("-- ============================================================\n")
w("-- AUTO-GENERATED SEED from 'ارسال قيود يومية .xlsx'. Run AFTER schema.sql\n")
w("-- ============================================================\n")
w("begin;\n\n")

w("-- entity\n")
w(f"insert into public.entities (id, name, currency) values ({q(ENTITY_ID)}, {q(ENTITY_NAME)}, 'EGP')\n")
w("  on conflict (id) do nothing;\n\n")

# categories
w("-- chart of accounts: categories\n")
w("insert into public.accounts (entity_id, code, name, type, report_category, category_name, is_postable) values\n")
vals = []
for c in categories:
    vals.append(f"  ({q(ENTITY_ID)}, {q('CAT::'+c)}, {q(c)}, 'category', {q(classify(c))}, {q(c)}, false)")
w(",\n".join(vals) + "\non conflict (entity_id, code) do nothing;\n\n")

# groups
w("-- chart of accounts: groups\n")
w("insert into public.accounts (entity_id, code, name, type, category_name, is_postable) values\n")
vals = []
for (cat, grp) in group_pairs:
    vals.append(f"  ({q(ENTITY_ID)}, {q('GRP::'+cat+'::'+grp)}, {q(grp)}, 'group', {q(cat)}, false)")
w(",\n".join(vals) + "\non conflict (entity_id, code) do nothing;\n\n")

# leaf accounts
w("-- chart of accounts: postable accounts\n")
w("insert into public.accounts (entity_id, code, name, type, report_category, group_name, category_name, is_postable) values\n")
vals = []
for r in acc.values():
    vals.append(f"  ({q(ENTITY_ID)}, {q(r['code'])}, {q(r['name'])}, 'account', {q(r['report'])}, {q(r['group'])}, {q(r['category'])}, true)")
w(",\n".join(vals) + "\non conflict (entity_id, code) do nothing;\n\n")

# link parents
w("-- link groups -> categories\n")
w("update public.accounts g set parent_id = c.id from public.accounts c\n")
w(f"  where g.entity_id = {q(ENTITY_ID)} and g.type='group' and c.type='category'\n")
w("    and c.entity_id = g.entity_id and c.code = 'CAT::' || g.category_name;\n\n")
w("-- link accounts -> groups\n")
w("update public.accounts a set parent_id = g.id from public.accounts g\n")
w(f"  where a.entity_id = {q(ENTITY_ID)} and a.type='account' and g.type='group'\n")
w("    and g.entity_id = a.entity_id and g.code = 'GRP::' || a.category_name || '::' || a.group_name;\n\n")

# projects
w("-- projects\n")
w("insert into public.projects (entity_id, name) values\n")
vals = [f"  ({q(ENTITY_ID)}, {q(p['name'])})" for p in projects]
w(",\n".join(vals) + "\non conflict (entity_id, name) do nothing;\n\n")

# journal entries
w("-- journal entries\n")
w("insert into public.journal_entries (entity_id, entry_no, ref_no, date, description) values\n")
vals = []
for no in sorted(entries):
    e = entries[no]
    vals.append(f"  ({q(ENTITY_ID)}, {no}, {q(e['ref'])}, {q(e['date'])}, {q(e['desc'])})")
w(",\n".join(vals) + "\non conflict (entity_id, entry_no) do nothing;\n\n")

# journal lines
w("-- journal lines\n")
w("insert into public.journal_lines (entry_id, account_id, project_id, debit, credit, description)\n")
w("select je.id, a.id, p.id, v.debit, v.credit, v.descr from (values\n")
vals = []
for (no, code, proj, deb, cr, desc) in jl:
    vals.append(f"  ({no}, {q(code)}, {q(proj)}, {num(deb)}, {num(cr)}, {q(desc)})")
w(",\n".join(vals) + "\n")
w(") as v(entry_no, code, projname, debit, credit, descr)\n")
w(f"join public.journal_entries je on je.entity_id = {q(ENTITY_ID)} and je.entry_no = v.entry_no\n")
w(f"join public.accounts a on a.entity_id = {q(ENTITY_ID)} and a.code = v.code\n")
w(f"left join public.projects p on p.entity_id = {q(ENTITY_ID)} and p.name = v.projname;\n\n")

w("commit;\n")

open(OUT, "w", encoding="utf-8").write(out.getvalue())
print("wrote", OUT)
print("categories:", len(categories), "groups:", len(group_pairs),
      "accounts:", len(acc), "projects:", len(projects),
      "entries:", len(entries), "lines:", len(jl))
