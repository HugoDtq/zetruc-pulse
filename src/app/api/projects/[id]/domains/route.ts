export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

const prisma = new PrismaClient();

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const rows = await prisma.domain.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, notes: true, competitors: true, createdAt: true, updatedAt: true },
  });
  return NextResponse.json(rows);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Optionnel: vérifier ownership du projet
  const project = await prisma.project.findUnique({ where: { id }, select: { ownerId: true } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (project.ownerId !== (session.user as any).id && session.user.group !== "ADMINISTRATEUR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { name, notes, competitors } = body as { name?: string; notes?: string; competitors?: string[] };

  if (!name || !name.trim()) {
    return NextResponse.json({ error: "Le nom du domaine d'activité est requis." }, { status: 400 });
  }

  const created = await prisma.domain.create({
    data: {
      projectId: id,
      name: name.trim(),
      notes: notes?.trim() || null,
      competitors: JSON.stringify(Array.isArray(competitors) ? competitors.filter(Boolean) : []),
    },
    select: { id: true },
  });

  return NextResponse.json(created, { status: 201 });
}
