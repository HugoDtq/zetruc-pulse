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

type AdminStats = {
  totals: { users: number; projects: number; domains: number; analyses: number };
  analyses: {
    last30Days: number;
    latest: Array<{
      id: string;
      projectName: string;
      createdAt: string;
      summary: {
        generatedAt: string;
        sentiment: string;
        questionCount: number;
        mentionYes: number;
        mentionRate: number;
        competitorCount: number;
        competitorNames: string[];
      };
    }>;
  };
  domains: {
    withoutCompetitors: number;
    alerts: Array<{ id: string; name: string; projectName: string; competitorCount: number }>;
  };
  llm: {
    configured: number;
    stale: Array<{ provider: string; updatedAt: string }>;
  };
  users: {
    newLast30Days: number;
    latest: Array<{ id: string; email: string; group: Group; createdAt: string }>;
  };
};

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
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

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

  async function fetchStats() {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const res = await fetch("/api/admin/stats");
      if (!res.ok) throw new Error();
      const json = (await res.json()) as AdminStats;
      setStats(json);
    } catch {
      setStatsError("Impossible de charger les statistiques globales.");
    } finally {
      setStatsLoading(false);
    }
  }
  useEffect(() => { fetchStats(); }, []);

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

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Vue d'ensemble</h2>
          <button
            onClick={fetchStats}
            disabled={statsLoading}
            className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            {statsLoading ? "Rafraîchissement…" : "Actualiser"}
          </button>
        </div>

        {statsError && <p className="text-sm text-rose-600">{statsError}</p>}

        {stats ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatTile label="Utilisateurs" value={stats.totals.users} helper={`+${stats.users.newLast30Days} sur 30 jours`} />
            <StatTile label="Projets" value={stats.totals.projects} helper={`${stats.domains.withoutCompetitors} projets sans veille active`} />
            <StatTile label="Domaines" value={stats.totals.domains} helper={`${stats.domains.alerts.length} domaines à compléter`} />
            <StatTile label="Analyses" value={stats.totals.analyses} helper={`${stats.analyses.last30Days} générées sur 30 jours`} />
          </div>
        ) : (
          <div className="rounded-lg border p-4 text-sm text-muted-foreground dark:border-zinc-700">
            Chargement des statistiques globales…
          </div>
        )}
      </section>

      {stats && (
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4 rounded-lg border p-4 dark:border-zinc-700">
            <h3 className="text-md font-semibold">Alertes veille concurrentielle</h3>
            {stats.domains.alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tous les domaines disposent d'au moins 3 concurrents suivis.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {stats.domains.alerts.map((item) => (
                  <li key={item.id} className="rounded-lg border border-dashed p-3 dark:border-zinc-600">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.projectName} • {item.competitorCount} concurrents suivis
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-4 rounded-lg border p-4 dark:border-zinc-700">
            <h3 className="text-md font-semibold">Activité analyses IA</h3>
            {stats.analyses.latest.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune analyse générée récemment.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {stats.analyses.latest.map((item) => (
                  <li key={item.id} className="rounded-lg border border-dashed p-3 dark:border-zinc-600">
                    <p className="font-medium">{item.projectName}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(item.summary.generatedAt).toLocaleString()} • {item.summary.mentionRate}% de visibilité • {item.summary.competitorCount} concurrents
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {stats && (
        <section className="rounded-lg border p-4 dark:border-zinc-700">
          <h3 className="text-md font-semibold">Nouveaux comptes</h3>
          {stats.users.latest.length === 0 ? (
            <p className="text-sm text-muted-foreground mt-2">Aucun compte créé récemment.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {stats.users.latest.map((user) => (
                <li key={user.id} className="flex items-center justify-between rounded-lg border border-dashed p-2 dark:border-zinc-600">
                  <div>
                    <p className="font-medium">{user.email}</p>
                    <p className="text-xs text-muted-foreground">{user.group} • {new Date(user.createdAt).toLocaleString()}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

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
          <h2 className="text-lg font-semibold">
            Clés API LLM
            {typeof stats?.llm.configured === "number" && (
              <span className="ml-2 text-sm text-muted-foreground">{stats.llm.configured} configurées</span>
            )}
          </h2>
        </div>
        <p className="text-sm opacity-75">
          Les clés sont <strong>chiffrées</strong> en base. On n’affiche jamais la valeur complète ; seulement les 4 derniers caractères.
        </p>

        <LlmKeysSection staleProviders={stats?.llm.stale ?? []} />
      </section>
    </div>
  );
}

/* =========================================================
   Sous-composants
========================================================= */

function StatTile({
  label,
  value,
  helper,
}: {
  label: string;
  value: number;
  helper?: string;
}) {
  return (
    <div className="rounded-xl border p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      {helper && <p className="mt-1 text-xs text-muted-foreground">{helper}</p>}
    </div>
  );
}

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
function LlmKeysSection({ staleProviders }: { staleProviders: Array<{ provider: string; updatedAt: string }> }) {
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
    const stale = staleProviders.find((item) => item.provider === provider);
    if (!row) return "Non configurée";
    const base = `Configurée (…${row.last4}) • ${new Date(row.updatedAt).toLocaleString()}`;
    return stale ? `${base} • ⚠️ à renouveler` : base;
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

  const hasStale = staleProviders.length > 0;

  return (
    <div className="space-y-4">
      {hasStale && (
        <div className="rounded-lg border border-amber-400 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-500 dark:bg-amber-500/10 dark:text-amber-200">
          Certaines clés n’ont pas été renouvelées depuis plus de 60 jours. Pensez à les regénérer pour éviter les coupures.
        </div>
      )}
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
