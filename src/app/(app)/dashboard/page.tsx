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

type DailyPoint = {
  date: string;
  label: string;
  value: number;
};

function buildDailySeries(dates: Array<Date | string>, span = 30): DailyPoint[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = new Date(today);
  start.setDate(start.getDate() - (span - 1));

  const counts = new Array(span).fill(0);
  for (const raw of dates) {
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) continue;
    date.setHours(0, 0, 0, 0);
    const diff = Math.floor((date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (diff >= 0 && diff < span) counts[diff] += 1;
  }

  const formatter = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" });
  return counts.map((value, idx) => {
    const pointDate = new Date(start);
    pointDate.setDate(start.getDate() + idx);
    return {
      date: pointDate.toISOString(),
      label: formatter.format(pointDate),
      value,
    } satisfies DailyPoint;
  });
}

function describeTrend(points: DailyPoint[], noun: string, pluralOverride?: string) {
  if (points.length === 0) return "Aucune donnée sur 30j";
  const half = Math.max(1, Math.floor(points.length / 2));
  const early = points.slice(0, half).reduce((sum, point) => sum + point.value, 0);
  const late = points.slice(half).reduce((sum, point) => sum + point.value, 0);
  const diff = late - early;
  if (diff === 0) return "Stable sur 30j";
  const direction = diff > 0 ? "+" : "−";
  const abs = Math.abs(diff);
  const nounToUse = abs > 1 ? pluralOverride ?? `${noun}s` : noun;
  return `${direction}${abs} ${nounToUse} vs début`;
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
    analysisTimelineRows,
    projectCreationRows,
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
        createdAt: true,
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
    prisma.projectAnalysis.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.project.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
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

  const analysisSeries = buildDailySeries(analysisTimelineRows.map((row) => row.createdAt));
  const domainSeries = buildDailySeries(domainRows.map((row) => row.createdAt));
  const projectSeries = buildDailySeries(projectCreationRows.map((row) => row.createdAt));
  const coverageSeries = buildDailySeries(domainRows.map((row) => row.updatedAt));
  const coverageUpdatesLast30 = coverageSeries.reduce((sum, point) => sum + point.value, 0);

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
        <StatCard
          label="Projets actifs"
          value={projectCount}
          helper="Nombre total de marques suivies"
          trend={{ series: projectSeries, label: describeTrend(projectSeries, "projet") }}
        />
        <StatCard
          label="Domaines cartographiés"
          value={domainCount}
          helper={`Dont ${domainsWithoutCompetitors} à enrichir`}
          trend={{ series: domainSeries, label: describeTrend(domainSeries, "domaine") }}
        />
        <StatCard
          label="Analyses générées"
          value={analysisCount}
          helper={`${analysesLast30Days} sur les 30 derniers jours`}
          trend={{ series: analysisSeries, label: describeTrend(analysisSeries, "analyse") }}
        />
        <StatCard
          label="Concurrents référencés"
          value={competitorFrequency.size}
          helper={`Entrées uniques toutes marques • ${coverageUpdatesLast30} mises à jour sur 30j`}
          trend={{ series: coverageSeries, label: describeTrend(coverageSeries, "mise à jour", "mises à jour") }}
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
  trend,
}: {
  label: string;
  value: number;
  helper?: string;
  trend?: { series: DailyPoint[]; label: string };
}) {
  return (
    <div className="rounded-2xl border p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/40">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
      {helper && <p className="mt-1 text-xs text-muted-foreground">{helper}</p>}
      {trend && (
        <div className="mt-4 space-y-1">
          <Sparkline series={trend.series} />
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{trend.label}</p>
        </div>
      )}
    </div>
  );
}

function Sparkline({ series }: { series: DailyPoint[] }) {
  if (series.length === 0) return null;
  const max = Math.max(...series.map((point) => point.value), 1);
  return (
    <div className="flex h-12 items-end gap-[3px]" aria-hidden>
      {series.map((point) => {
        const ratio = point.value / max;
        const height = Math.max(4, Math.round(ratio * 100));
        return (
          <div
            key={point.date}
            className="flex-1 rounded-t-md bg-gradient-to-t from-indigo-500/70 via-indigo-500/40 to-indigo-500/20 dark:from-indigo-400/70 dark:via-indigo-400/40 dark:to-indigo-400/20"
            style={{ height: `${height}%` }}
            title={`${point.value} le ${point.label}`}
          />
        );
      })}
    </div>
  );
}
