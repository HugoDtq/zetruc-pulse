export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { PrismaClient, Group } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();
const isAdmin = (s: any) => s?.user?.group === "ADMINISTRATEUR";

// GET /api/admin/users?q=&group=&sort=&order=&page=&pageSize=
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const groupParam = searchParams.get("group");
  const sort = (searchParams.get("sort") ?? "createdAt") as "createdAt" | "email";
  const order = (searchParams.get("order") ?? "desc") as "asc" | "desc";
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(50, Math.max(5, Number(searchParams.get("pageSize") ?? 10)));
  const skip = (page - 1) * pageSize;

  const where: any = {};
  if (q) {
    where.OR = [{ email: { contains: q } }, { name: { contains: q } }]; // SQLite OK
  }
  if (groupParam && (Object.values(Group) as string[]).includes(groupParam)) {
    where.group = groupParam;
  }

  const [total, items] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { [sort]: order },
      skip,
      take: pageSize,
      select: { id: true, email: true, name: true, group: true, createdAt: true },
    }),
  ]);

  return NextResponse.json({ items, total, page, pageSize, sort, order });
}

// POST (création)
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { email, name, password, group }: {
    email?: string; name?: string; password?: string; group?: keyof typeof Group
  } = body;

  if (!email || !password) {
    return NextResponse.json({ error: "Email et mot de passe requis" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Mot de passe trop court (min 6)" }, { status: 400 });
  }

  const parsedGroup = group && (Object.values(Group) as string[]).includes(group)
    ? (group as Group)
    : Group.UTILISATEUR;

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, name: name ?? "", passwordHash, group: parsedGroup },
      select: { id: true, email: true, name: true, group: true, createdAt: true },
    });
    return NextResponse.json(user, { status: 201 });
  } catch (e: any) {
    if (e?.code === "P2002") return NextResponse.json({ error: "Email déjà utilisé" }, { status: 409 });
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
