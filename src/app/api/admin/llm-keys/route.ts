export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { PrismaClient, LLMProvider } from "@prisma/client";
import { encrypt } from "@/lib/crypto";

const prisma = new PrismaClient();
const isAdmin = (s: any) => s?.user?.group === "ADMINISTRATEUR";

// GET → liste statut des clés (pas de déchiffrement)
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await prisma.llmApiKey.findMany({
    select: { provider: true, last4: true, updatedAt: true },
    orderBy: { provider: "asc" },
  });

  return NextResponse.json(rows);
}

// POST { provider, apiKey } → crée/écrase la clé du provider
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { provider, apiKey } = body as { provider?: keyof typeof LLMProvider; apiKey?: string };
  if (!provider || !apiKey) {
    return NextResponse.json({ error: "provider et apiKey requis" }, { status: 400 });
  }
  if (!(provider in LLMProvider)) {
    return NextResponse.json({ error: "provider invalide" }, { status: 400 });
  }

  const { ciphertext, iv, tag } = encrypt(apiKey);
  const last4 = apiKey.slice(-4);

  const row = await prisma.llmApiKey.upsert({
    where: { provider: provider as LLMProvider },
    update: {
      keyCiphertext: ciphertext,
      keyIv: iv,
      keyTag: tag,
      last4,
    },
    create: {
      provider: provider as LLMProvider,
      keyCiphertext: ciphertext,
      keyIv: iv,
      keyTag: tag,
      last4,
      createdById: (session.user as any).id,
    },
    select: { provider: true, last4: true, updatedAt: true },
  });

  return NextResponse.json(row, { status: 201 });
}
