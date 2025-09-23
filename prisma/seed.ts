import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
const prisma = new PrismaClient();

async function main() {
  const pwd = await bcrypt.hash("password123", 10);
  await prisma.user.upsert({
    where: { email: "admin@zetruc.dev" },
    update: {},
    create: { email: "admin@zetruc.dev", name: "Admin", passwordHash: pwd, role: "superadmin" },
  });
  await prisma.user.upsert({
    where: { email: "user@zetruc.dev" },
    update: {},
    create: { email: "user@zetruc.dev", name: "User", passwordHash: pwd, role: "user" },
  });
}
main().finally(() => prisma.$disconnect());
