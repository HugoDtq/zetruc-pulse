export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

const prisma = new PrismaClient();

type CompetitorSuggestionInput = {
  name?: string;
  website?: string;
  reason?: string;
};

/**
 * Lire un domaine (facultatif, utile si tu veux fetch côté client)
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; domainId: string }> }
) {
  const { id, domainId } = await params;
  const domain = await prisma.domain.findUnique({
    where: { id: domainId },
    select: {
      id: true,
      name: true,
      notes: true,
      competitors: true,
      suggestions: true,
      createdAt: true,
      updatedAt: true,
      projectId: true,
    },
  });
  if (!domain || domain.projectId !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(domain);
}

/**
 * Mettre à jour un domaine
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; domainId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, domainId } = await params;

  const domain = await prisma.domain.findUnique({
    where: { id: domainId },
    select: { id: true, project: { select: { id: true, ownerId: true } } },
  });
  if (!domain || domain.project.id !== id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = (session.user as any).group === "ADMINISTRATEUR";
  const isOwner = domain.project.ownerId === (session.user as any).id;
  if (!isAdmin && !isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { name, notes, competitors, suggestions } = body as {
    name?: string;
    notes?: string | null;
    competitors?: string[] | null;
    suggestions?: CompetitorSuggestionInput[] | string[] | null;
  };

  const data: any = {};
  if (typeof name === "string") data.name = name.trim();
  if (typeof notes === "string" || notes === null) data.notes = notes?.trim() || null;
  if (Array.isArray(competitors)) data.competitors = JSON.stringify(competitors.filter(Boolean));
  if (Array.isArray(suggestions)) {
    const normalized = suggestions
      .map((item) => {
        if (typeof item === "string") {
          const name = item.trim();
          return name ? { name } : null;
        }
        const name = String(item?.name ?? "").trim();
        if (!name) return null;
        return {
          name,
          website: item?.website ? String(item.website) : undefined,
          reason: item?.reason ? String(item.reason) : undefined,
        };
      })
      .filter((entry): entry is { name: string; website?: string; reason?: string } => Boolean(entry));

    data.suggestions = JSON.stringify(normalized);
  }

  const updated = await prisma.domain.update({
    where: { id: domainId },
    data,
    select: {
      id: true,
      name: true,
      notes: true,
      competitors: true,
      suggestions: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(updated);
}

/**
 * Supprimer un domaine (déjà existant chez toi ; gardé ici)
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; domainId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, domainId } = await params;

  const domain = await prisma.domain.findUnique({
    where: { id: domainId },
    select: { id: true, project: { select: { id: true, ownerId: true } } },
  });
  if (!domain || domain.project.id !== id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = (session.user as any).group === "ADMINISTRATEUR";
  const isOwner = domain.project.ownerId === (session.user as any).id;
  if (!isAdmin && !isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.domain.delete({ where: { id: domainId } });
  return new NextResponse(null, { status: 204 });
}
