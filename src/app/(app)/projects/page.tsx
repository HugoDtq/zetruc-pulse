import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { PrismaClient } from "@prisma/client";
import NewProjectForm from "@/components/NewProjectForm";
import ProjectRow from "@/components/ProjectRow";

const prisma = new PrismaClient();
export const runtime = "nodejs";

export default async function ProjectsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const projects = await prisma.project.findMany({
    where: { ownerId: (session.user as any).id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Projets</h1>
          <p className="text-sm text-gray-600 dark:text-zinc-400">
            Liste de vos projets LLM et indicateurs GEO.
          </p>
        </div>
        <NewProjectForm />
      </div>

      <ul className="overflow-hidden rounded-2xl border bg-white dark:bg-zinc-900 dark:border-zinc-800">
        {projects.length === 0 && (
          <li className="p-6 text-sm text-gray-500 dark:text-zinc-400">
            Aucun projet pour le moment. Créez-en un !
          </li>
        )}
        {projects.map((p) => (
          <ProjectRow key={p.id} id={p.id} name={p.name} createdAt={p.createdAt as unknown as string} />
        ))}
      </ul>
    </div>
  );
}
