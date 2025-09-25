export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PrismaClient } from "@prisma/client";
import { authOptions } from "@/lib/authOptions";
import { AnalysisReportSchema } from "@/types/analysis";
import { summarizeAnalysis } from "@/lib/analysisSummary";

const prisma = new PrismaClient();

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user?.group !== "ADMINISTRATEUR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 30);
  const sixtyDaysAgo = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 60);

  const [
    totalUsers,
    totalProjects,
    totalDomains,
    totalAnalyses,
    analysesLast30,
    latestAnalyses,
    domainRows,
    llmKeys,
    newUsersLast30,
    latestUsers,
  ] = await Promise.all([
    prisma.user.count(),
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
        project: { select: { id: true, name: true } },
      },
    }),
    prisma.llmApiKey.findMany({
      orderBy: { updatedAt: "desc" },
      select: { provider: true, updatedAt: true },
    }),
    prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, email: true, group: true, createdAt: true },
    }),
  ]);

  const analysisSummaries = latestAnalyses
    .map((item) => {
      const parsed = AnalysisReportSchema.safeParse(item.report);
      if (!parsed.success) return null;
      return {
        id: item.id,
        projectName: item.project.name,
        createdAt: item.createdAt.toISOString(),
        summary: summarizeAnalysis(parsed.data),
      };
    })
    .filter((entry): entry is {
      id: string;
      projectName: string;
      createdAt: string;
      summary: ReturnType<typeof summarizeAnalysis>;
    } => Boolean(entry));

  const domainCoverage = domainRows.map((domain) => {
    let competitors: string[] = [];
    try {
      const parsed = JSON.parse(domain.competitors);
      competitors = Array.isArray(parsed) ? parsed.map((item) => String(item)).filter(Boolean) : [];
    } catch {
      competitors = [];
    }
    return {
      id: domain.id,
      name: domain.name,
      projectName: domain.project.name,
      competitorCount: competitors.length,
    };
  });

  const coverageAlerts = domainCoverage
    .filter((item) => item.competitorCount < 3)
    .slice(0, 5);

  const llmStale = llmKeys
    .filter((key) => key.updatedAt < sixtyDaysAgo)
    .map((key) => ({ provider: key.provider, updatedAt: key.updatedAt.toISOString() }));

  return NextResponse.json({
    totals: {
      users: totalUsers,
      projects: totalProjects,
      domains: totalDomains,
      analyses: totalAnalyses,
    },
    analyses: {
      last30Days: analysesLast30,
      latest: analysisSummaries,
    },
    domains: {
      withoutCompetitors: domainCoverage.filter((item) => item.competitorCount === 0).length,
      alerts: coverageAlerts,
    },
    llm: {
      configured: llmKeys.length,
      stale: llmStale,
    },
    users: {
      newLast30Days: newUsersLast30,
      latest: latestUsers.map((user) => ({
        id: user.id,
        email: user.email,
        group: user.group,
        createdAt: user.createdAt.toISOString(),
      })),
    },
  });
}
