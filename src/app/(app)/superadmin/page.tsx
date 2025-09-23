"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDebouncedCallback } from "use-debounce";
import { useToast } from "@/components/ui/use-toast";
import UserRow, { type Group } from "@/components/admin/UserRow";
import { useSession } from "next-auth/react";

/* =========================================================
   Types
========================================================= */
type User = { id: string; email: string; group: Group; createdAt: string };

type ApiList = {
  items: User[];
  total: number;
  page: number;
  pageSize: number;
  sort: "createdAt" | "email";
  order: "asc" | "desc";
};

type LlmRow = { provider: string; last4: string | null; updatedAt: string };

const PROVIDERS: Array<{ id: string; label: string; placeholder: string }> = [
  { id: "OPENAI",     label: "OpenAI",               placeholder: "sk-..." },
  { id: "ANTHROPIC",  label: "Claude (Anthropic)",   placeholder: "sk-ant-..." },
  { id: "GEMINI",     label: "Gemini (Google)",      placeholder: "AIza..." },
  { id: "PERPLEXITY", label: "Perplexity",           placeholder: "pplx-..." },
  { id: "GROK",       label: "Grok (xAI)",           placeholder: "xai-..." },
];

/* =========================================================
   Page
========================================================= */
export default function SuperadminPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const { toast } = useToast();
  const { data: session } = useSession();
  const selfId = (session?.user as any)?.id as string | undefined;

  // URL state (liste utilisateurs)
  const q = sp.get("q") ?? "";
  const group = (sp.get("group") ?? "") as "" | Group;
  const sort = (sp.get("sort") ?? "createdAt") as "createdAt" | "email";
  const order = (sp.get("order") ?? "desc") as "asc" | "desc";
  const page = Math.max(1, Number(sp.get("page") ?? 1));
  const pageSize = Math.min(50, Math.max(5, Number(sp.get("pageSize") ?? 10)));

  const [data, setData] = useState<ApiList | null>(null);
  const [loading, setLoading] = useState(false);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (group) p.set("group", group);
    p.set("sort", sort);
    p.set("order", order);
    p.set("page", String(page));
    p.set("pageSize", String(pageSize));
    return p.toString();
  }, [q, group, sort, order, page, pageSize]);

  async function fetchList() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users?${qs}`);
      if (!res.ok) throw new Error();
      const json = (await res.json()) as ApiList;
      setData(json);
    } catch {
      toast({ title: "Erreur", description: "Impossible de charger les utilisateurs." });
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { fetchList(); /* eslint-disable-next-line */ }, [qs]);

  // handlers URL
  const setParam = (key: string, val?: string) => {
    const params = new URLSearchParams(sp.toString());
    if (val && val.length) params.set(key, val);
    else params.delete(key);
    params.set("page", "1");
    router.replace(`/superadmin?${params.toString()}`);
  };
  const onSearch = useDebouncedCallback((value: string) => setParam("q", value), 300);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="p-6 space-y-10">
      <h1 className="text-2xl font-bold">Superadmin</h1>

      {/* =====================================================
          Bloc : Gestion des utilisateurs
      ===================================================== */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Utilisateurs</h2>
        </div>

        {/* Recherche + filtre groupe */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            defaultValue={q}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Rechercher un utilisateur…"
            className="w-full max-w-md rounded-lg border border-gray-300 px-4 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <select
            value={group}
            onChange={(e) => setParam("group", e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">Tous les groupes</option>
            <option value="UTILISATEUR">Utilisateur</option>
            <option value="AGENCE">Agence</option>
            <option value="ADMINISTRATEUR">Administrateur</option>
          </select>
        </div>

        {/* Création utilisateur */}
        <CreateUserCard onCreated={() => fetchList()} />

        {/* Liste + tri + pagination */}
        <div className="rounded-lg border border-gray-200 dark:border-zinc-700 overflow-x-auto">
          {loading || !data ? (
            <p className="p-4">Chargement…</p>
          ) : (
            <>
              <table className="w-full border-collapse text-sm">
                <thead className="bg-gray-100 dark:bg-zinc-800">
                  <tr>
                    <Th
                      label="Email"
                      active={sort === "email"}
                      order={order}
                      onClick={() => {
                        setParam("sort", "email");
                        setParam("order", sort === "email" && order === "asc" ? "desc" : "asc");
                      }}
                    />
                    <th className="px-4 py-2 text-left">Groupe</th>
                    <th className="px-4 py-2 text-left">Nouveau mot de passe</th>
                    <Th
                      label="Créé le"
                      active={sort === "createdAt"}
                      order={order}
                      alignRight
                      onClick={() => {
                        setParam("sort", "createdAt");
                        setParam("order", sort === "createdAt" && order === "asc" ? "desc" : "asc");
                      }}
                    />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((u) => (
                    <UserRow key={u.id} id={u.id} email={u.email} group={u.group} selfId={selfId} />
                  ))}
                  {data.items.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-4 text-center opacity-70">
                        Aucun utilisateur trouvé.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div className="flex items-center justify-between p-3">
                <div className="text-xs opacity-70">
                  Total : {data.total} • Page {data.page}/{totalPages}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setParam("page", String(Math.max(1, page - 1)))}
                    disabled={page <= 1}
                    className="rounded-lg border px-3 py-1.5 disabled:opacity-50"
                  >
                    Précédent
                  </button>
                  <button
                    onClick={() => setParam("page", String(Math.min(totalPages, page + 1)))}
                    disabled={page >= totalPages}
                    className="rounded-lg border px-3 py-1.5 disabled:opacity-50"
                  >
                    Suivant
                  </button>
                  <select
                    value={String(pageSize)}
                    onChange={(e) => setParam("pageSize", e.target.value)}
                    className="rounded-lg border px-2 py-1.5"
                  >
                    {[10, 20, 30, 50].map((n) => (
                      <option key={n} value={n}>{n}/page</option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {/* =====================================================
          Bloc : Clés API LLM
      ===================================================== */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Clés API LLM</h2>
        </div>
        <p className="text-sm opacity-75">
          Les clés sont <strong>chiffrées</strong> en base. On n’affiche jamais la valeur complète ; seulement les 4 derniers caractères.
        </p>

        <LlmKeysSection />
      </section>
    </div>
  );
}

/* =========================================================
   Sous-composants
========================================================= */

function Th({
  label,
  active,
  order,
  onClick,
  alignRight,
}: {
  label: string;
  active?: boolean;
  order?: "asc" | "desc";
  onClick?: () => void;
  alignRight?: boolean;
}) {
  return (
    <th className={`px-4 py-2 ${alignRight ? "text-right" : "text-left"}`}>
      <button onClick={onClick} className="inline-flex items-center gap-1 hover:underline">
        {label}
        {active && (order === "asc" ? "▲" : "▼")}
      </button>
    </th>
  );
}

/* ---------- CreateUserCard ---------- */
import { useToast as useToast2 } from "@/components/ui/use-toast";

function CreateUserCard({ onCreated }: { onCreated: () => void }) {
  const { toast } = useToast2();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [group, setGroup] = useState<Group>("UTILISATEUR");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!email || !password) {
      toast({ title: "Champs manquants", description: "Email et mot de passe requis." });
      return;
    }
    setBusy(true);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, group }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast({ title: "Création échouée", description: j.error ?? "Erreur inconnue" });
      return;
    }
    toast({ title: "Utilisateur créé", description: email });
    setEmail(""); setPassword(""); setGroup("UTILISATEUR");
    onCreated();
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-gray-200 p-4 dark:border-zinc-700">
      <h3 className="font-semibold">Créer un utilisateur</h3>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="rounded-lg border border-gray-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
      />
      <input
        type="password"
        placeholder="Mot de passe"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="rounded-lg border border-gray-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
      />
      <select
        value={group}
        onChange={(e) => setGroup(e.target.value as Group)}
        className="rounded-lg border border-gray-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
      >
        <option value="UTILISATEUR">Utilisateur</option>
        <option value="AGENCE">Agence</option>
        <option value="ADMINISTRATEUR">Administrateur</option>
      </select>
      <button
        onClick={submit}
        disabled={busy}
        className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {busy ? "Création…" : "Ajouter"}
      </button>
    </div>
  );
}

/* ---------- LlmKeysSection ---------- */
function LlmKeysSection() {
  const { toast } = useToast();
  const [rows, setRows] = useState<LlmRow[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/llm-keys");
    const data = (await res.json()) as LlmRow[];
    setRows(data);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function status(provider: string) {
    const row = rows.find((r) => r.provider === provider);
    if (!row) return "Non configurée";
    return `Configurée (…${row.last4}) • ${new Date(row.updatedAt).toLocaleString()}`;
  }

  async function save(provider: string) {
    const apiKey = values[provider];
    if (!apiKey) {
      toast({ title: "Clé manquante", description: "Renseigne la clé avant d’enregistrer." });
      return;
    }
    const res = await fetch("/api/admin/llm-keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider, apiKey }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast({ title: "Échec", description: j.error ?? "Impossible d’enregistrer la clé." });
      return;
    }
    toast({ title: "Clé enregistrée", description: provider });
    setValues((v) => ({ ...v, [provider]: "" }));
    load();
  }

  async function remove(provider: string) {
    if (!confirm(`Supprimer la clé ${provider} ?`)) return;
    const res = await fetch(`/api/admin/llm-keys/${provider}`, { method: "DELETE" });
    if (!res.ok) {
      toast({ title: "Échec", description: "Impossible de supprimer la clé." });
      return;
    }
    toast({ title: "Clé supprimée", description: provider });
    load();
  }

  return (
    <div className="space-y-4">
      {PROVIDERS.map((p) => (
        <div key={p.id} className="rounded-xl border p-4 dark:border-zinc-700">
          <div className="mb-2 flex items-center justify-between">
            <div className="font-medium">{p.label}</div>
            <div className="text-xs opacity-70">{status(p.id)}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="password"
              value={values[p.id] ?? ""}
              onChange={(e) => setValues({ ...values, [p.id]: e.target.value })}
              placeholder={p.placeholder}
              className="w-full max-w-md rounded-lg border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
            <button
              onClick={() => save(p.id)}
              className="rounded-lg bg-blue-600 px-3 py-2 text-white hover:bg-blue-700"
            >
              Enregistrer
            </button>
            <button
              onClick={() => remove(p.id)}
              className="rounded-lg border px-3 py-2 hover:bg-gray-50 dark:hover:bg-zinc-800"
            >
              Supprimer
            </button>
          </div>
        </div>
      ))}
      {loading && <div className="text-sm opacity-70">Chargement…</div>}
    </div>
  );
}
