import { PrismaClient } from "@prisma/client";
import BrandEditDialog from "@/components/projects/BrandEditDialog";
import DomainCreateDialog from "@/components/projects/DomainCreateDialog";
import DomainCard from "@/components/projects/DomainCard";

const prisma = new PrismaClient();

type PageProps = { params: Promise<{ id: string }> };

export default async function ProjectPage({ params }: PageProps) {
  const { id } = await params;

  const [project, domains] = await Promise.all([
    prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        countryCode: true,
        city: true,
        websiteUrl: true,
        description: true,
        aliasesJson: true,
        logoUrl: true,
        createdAt: true,
      },
    }),
    prisma.domain.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, notes: true, competitors: true, updatedAt: true },
    }),
  ]);

  if (!project) return <div className="p-6">Projet introuvable.</div>;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {project.logoUrl && <img src={project.logoUrl} alt="" className="h-10 w-10 rounded-lg object-contain border dark:border-zinc-800" />}
          <h1 className="text-2xl font-semibold">{project.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <BrandEditDialog projectId={project.id} initial={project} />
          <DomainCreateDialog projectId={project.id} />
        </div>
      </div>

      {/* Résumé */}
      <div className="rounded-2xl border p-4 dark:border-zinc-800">
        <div className="text-sm opacity-70">Résumé</div>
        <ul className="mt-2 text-sm leading-6">
          <li><b>Pays :</b> {project.countryCode ?? "—"}</li>
          <li><b>Ville :</b> {project.city ?? "—"}</li>
          <li>
            <b>Site :</b>{" "}
            {project.websiteUrl ? <a href={project.websiteUrl} target="_blank" className="underline">{project.websiteUrl}</a> : "—"}
          </li>
          <li><b>Description :</b> {project.description || "—"}</li>
          <li>
            <b>Alias :</b>{" "}
            {(() => { try { const a = JSON.parse(project.aliasesJson || "[]"); return a.length ? a.join(", ") : "—"; } catch { return "—"; } })()}
          </li>
        </ul>
      </div>

      {/* Domaines d'activité */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Domaines d'activité</h2>
          <DomainCreateDialog projectId={project.id} />
        </div>

        {domains.length === 0 ? (
          <div className="rounded-2xl border p-6 text-center text-sm opacity-70 dark:border-zinc-800">
            Aucun Domaine d'activité pour l’instant — commencez par en ajouter un.
          </div>
        ) : (
          <div className="grid gap-3">
            {domains.map((d) => (
              <DomainCard key={d.id} projectId={project.id} domain={d as any} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
