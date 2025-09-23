export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function asArray(input: unknown): string[] {
  if (Array.isArray(input)) return input.filter(Boolean).map(String);
  if (typeof input === "string" && input.trim()) {
    try {
      const j = JSON.parse(input);
      if (Array.isArray(j)) return j.filter(Boolean).map(String);
    } catch {}
    return [input];
  }
  return [];
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Vérifier que l'utilisateur a accès au projet
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (project.ownerId !== (session.user as any).id && session.user.group !== "ADMINISTRATEUR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const {
    name,
    countryCode,
    city,
    websiteUrl,
    description,
    aliases,
    logoUrl,
  } = body as {
    name?: string;
    countryCode?: string | null;
    city?: string | null;
    websiteUrl?: string | null;
    description?: string | null;
    aliases?: string[] | string | null;
    logoUrl?: string | null;
  };

  const data: any = {};
  if (typeof name === "string") data.name = name.trim();
  if (countryCode !== undefined) data.countryCode = countryCode || null;
  if (city !== undefined) data.city = city || null;
  if (websiteUrl !== undefined) data.websiteUrl = websiteUrl || null;
  if (description !== undefined) data.description = description || null;
  if (aliases !== undefined) data.aliasesJson = JSON.stringify(asArray(aliases));
  if (logoUrl !== undefined) data.logoUrl = logoUrl || null;

  const updated = await prisma.project.update({
    where: { id },
    data,
    select: {
      id: true,
      name: true,
      countryCode: true,
      city: true,
      websiteUrl: true,
      description: true,
      aliasesJson: true,
      logoUrl: true,
    },
  });

  return NextResponse.json(updated);
}
