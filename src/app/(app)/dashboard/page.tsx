import { PrismaClient } from "@prisma/client";
import { AnalysisReportSchema } from "@/types/analysis";
import { summarizeAnalysis } from "@/lib/analysisSummary";

const prisma = new PrismaClient();

function parseCompetitors(value: string): string[] {
  try {
    const arr = JSON.parse(value);
    return Array.isArray(arr) ? arr.map((item) => String(item)).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function formatRelative(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default async function DashboardPage() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 30);

  const [
    projectCount,
    domainCount,
    analysisCount,
    analysesLast30Days,
    recentAnalyses,
    domainRows,
    recentProjects,
  ] = await Promise.all([
    prisma.project.count(),
    prisma.domain.count(),
    prisma.projectAnalysis.count(),
    prisma.projectAnalysis.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.projectAnalysis.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        createdAt: true,
        report: true,
        project: { select: { id: true, name: true } },
      },
    }),
    prisma.domain.findMany({
      select: {
        id: true,
        name: true,
        competitors: true,
        updatedAt: true,
        project: { select: { id: true, name: true } },
      },
    }),
    prisma.project.findMany({
      orderBy: { updatedAt: "desc" },
      take: 3,
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        domains: { select: { id: true } },
        analyses: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true },
        },
      },
    }),
  ]);

  const competitorFrequency = new Map<string, number>();
  const coverage = domainRows.map((domain) => {
    const competitors = parseCompetitors(domain.competitors);
    competitors.forEach((name) => {
      const key = name.trim();
      if (!key) return;
      competitorFrequency.set(key, (competitorFrequency.get(key) ?? 0) + 1);
    });
    return {
      id: domain.id,
      name: domain.name,
      projectName: domain.project.name,
      competitorCount: competitors.length,
      updatedAt: domain.updatedAt.toISOString(),
    };
  });

  const topCompetitors = Array.from(competitorFrequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const analyses = recentAnalyses
    .map((row) => {
      const parsed = AnalysisReportSchema.safeParse(row.report);
      if (!parsed.success) return null;
      const summary = summarizeAnalysis(parsed.data);
      return {
        id: row.id,
        projectName: row.project.name,
        createdAt: row.createdAt.toISOString(),
        summary,
      };
    })
    .filter((entry): entry is {
      id: string;
      projectName: string;
      createdAt: string;
      summary: ReturnType<typeof summarizeAnalysis>;
    } => Boolean(entry));

  const domainsWithoutCompetitors = coverage.filter((item) => item.competitorCount === 0).length;
  const domainsLightCoverage = coverage
    .filter((item) => item.competitorCount > 0 && item.competitorCount < 3)
    .slice(0, 4);

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Projets actifs" value={projectCount} helper="Nombre total de marques suivies" />
        <StatCard
          label="Domaines cartographiés"
          value={domainCount}
          helper={`Dont ${domainsWithoutCompetitors} à enrichir`}
        />
        <StatCard
          label="Analyses générées"
          value={analysisCount}
          helper={`${analysesLast30Days} sur les 30 derniers jours`}
        />
        <StatCard
          label="Concurrents référencés"
          value={competitorFrequency.size}
          helper="Entrées uniques toutes marques"
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border p-5 dark:border-zinc-800">
            <h2 className="text-lg font-semibold">Dernières analyses</h2>
            {analyses.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Aucune analyse n’a encore été générée.
              </p>
            ) : (
              <ul className="mt-4 space-y-3 text-sm">
                {analyses.map((item) => (
                  <li key={item.id} className="rounded-xl border p-3 dark:border-zinc-800">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{item.projectName}</p>
                        <p className="text-xs text-muted-foreground">
                          Générée le {formatRelative(item.summary.generatedAt)} • {item.summary.mentionRate}% de présence • {item.summary.competitorCount} concurrents cités
                        </p>
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">{item.summary.sentiment}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border p-5 dark:border-zinc-800">
            <h2 className="text-lg font-semibold">Focus veille concurrentielle</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold">Top concurrents cités</h3>
                {topCompetitors.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">Aucun concurrent recensé pour le moment.</p>
                ) : (
                  <ul className="mt-2 space-y-2 text-sm">
                    {topCompetitors.map(([name, score]) => (
                      <li
                        key={name}
                        className="flex items-center justify-between rounded-lg border border-dashed p-2 dark:border-zinc-700"
                      >
                        <span>{name}</span>
                        <span className="text-xs text-muted-foreground">{score} domaines</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h3 className="text-sm font-semibold">Domaines à consolider</h3>
                {domainsLightCoverage.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Tous les domaines disposent d’au moins 3 concurrents suivis.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-2 text-sm">
                    {domainsLightCoverage.map((item) => (
                      <li key={item.id} className="rounded-lg border border-dashed p-2 dark:border-zinc-700">
                        <p className="font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.projectName} • {item.competitorCount} concurrents suivis
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border p-5 dark:border-zinc-800">
            <h2 className="text-lg font-semibold">Projets en activité</h2>
            <ul className="mt-3 space-y-3 text-sm">
              {recentProjects.map((project) => (
                <li key={project.id} className="rounded-xl border p-3 dark:border-zinc-800">
                  <p className="font-medium">{project.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {project.domains.length} domaines suivis • dernière mise à jour {formatRelative(project.updatedAt.toISOString())}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Dernière analyse {project.analyses[0]?.createdAt ? formatRelative(project.analyses[0].createdAt.toISOString()) : "jamais"}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: number;
  helper?: string;
}) {
  return (
    <div className="rounded-2xl border p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/40">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
      {helper && <p className="mt-1 text-xs text-muted-foreground">{helper}</p>}
    </div>
  );
}
