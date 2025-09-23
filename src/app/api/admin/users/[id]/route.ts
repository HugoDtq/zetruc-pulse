export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { PrismaClient, Group } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();
const isAdmin = (s: any) => s?.user?.group === "ADMINISTRATEUR";

// PATCH /api/admin/users/:id
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }   // 👈 params est un Promise
) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: userId } = await params;              // 👈 on await ici

  const body = await req.json().catch(() => ({}));
  const { password, group }: { password?: string; group?: keyof typeof Group } = body;

  const data: { passwordHash?: string; group?: Group } = {};
  if (typeof password === "string") {
    if (password.length < 6) {
      return NextResponse.json({ error: "Mot de passe trop court (min 6)" }, { status: 400 });
    }
    data.passwordHash = await bcrypt.hash(password, 10);
  }
  if (group && Group[group]) data.group = group as Group;

  if (!data.passwordHash && !data.group) {
    return NextResponse.json({ error: "Aucune mise à jour valide" }, { status: 400 });
  }

  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, email: true, name: true, group: true, createdAt: true },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }
}

// DELETE /api/admin/users/:id
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }   // 👈 idem
) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: userId } = await params;              // 👈 on await

  if (session.user?.id === userId) {
    return NextResponse.json(
      { error: "Vous ne pouvez pas supprimer votre propre compte" },
      { status: 400 }
    );
  }

  try {
    await prisma.user.delete({ where: { id: userId } });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }
}
