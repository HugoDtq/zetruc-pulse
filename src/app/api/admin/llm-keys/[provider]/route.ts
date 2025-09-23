export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { PrismaClient, LLMProvider } from "@prisma/client";

const prisma = new PrismaClient();
const isAdmin = (s: any) => s?.user?.group === "ADMINISTRATEUR";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { provider } = await params;
  if (!(provider in LLMProvider)) {
    return NextResponse.json({ error: "provider invalide" }, { status: 400 });
  }

  await prisma.llmApiKey.delete({ where: { provider: provider as LLMProvider } }).catch(() => {});
  return new NextResponse(null, { status: 204 });
}
