"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useMemo, useState } from "react";
import { Country, City } from "country-state-city";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";

type InitialProject = {
  id?: string;
  name: string;
  countryCode?: string | null;
  city?: string | null;
  websiteUrl?: string | null;
  description?: string | null;
  aliasesJson: string; // JSON.stringify(string[])
  logoUrl?: string | null;
};

type Props = {
  projectId: string;
  initial: InitialProject;
};

function parseAliases(json: string | undefined) {
  try {
    const arr = json ? JSON.parse(json) : [];
    return Array.isArray(arr) ? (arr as string[]) : [];
  } catch {
    return [];
  }
}

export default function BrandEditDialog({ projectId, initial }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  /**
   * `base` = dernière version “source de vérité” connue côté client.
   * - Initialisée avec `initial`
   * - Mise à jour après un PATCH réussi
   * - Le reset du formulaire se fait toujours depuis `base` (et non plus `initial`)
   */
  const [base, setBase] = useState<InitialProject>(initial);

  // ---- form state
  const [name, setName] = useState(base.name);
  const [country, setCountry] = useState(base.countryCode ?? "");
  const [city, setCity] = useState(base.city ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(base.websiteUrl ?? "");
  const [description, setDescription] = useState(base.description ?? "");
  const [aliases, setAliases] = useState<string[]>(() => parseAliases(base.aliasesJson));
  const [aliasInput, setAliasInput] = useState("");
  const [logoUrl, setLogoUrl] = useState(base.logoUrl ?? "");

  const [saving, setSaving] = useState(false);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);

  // Si on ferme le drawer, on prépare le prochain open en réinitialisant depuis `base`
  useEffect(() => {
    if (!open) {
      setName(base.name);
      setCountry(base.countryCode ?? "");
      setCity(base.city ?? "");
      setWebsiteUrl(base.websiteUrl ?? "");
      setDescription(base.description ?? "");
      setAliases(parseAliases(base.aliasesJson));
      setAliasInput("");
      setLogoUrl(base.logoUrl ?? "");
      setFileToUpload(null);
      setUploading(false);
    }
  }, [open, base]);

  // Si le serveur renvoie de nouvelles `initial` (ex: navigation), on resynchronise `base`
  useEffect(() => {
    setBase(initial);
  }, [initial]);

  const countries = useMemo(() => Country.getAllCountries(), []);
  const cities = useMemo(() => (country ? City.getCitiesOfCountry(country) ?? [] : []), [country]);

  function addAlias() {
    const v = aliasInput.trim();
    if (!v) return;
    if (!aliases.includes(v)) setAliases([...aliases, v]);
    setAliasInput("");
  }
  function removeAlias(a: string) {
    setAliases(aliases.filter((x) => x !== a));
  }

  async function handleUpload() {
    if (!fileToUpload) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", fileToUpload);
      const res = await fetch("/api/uploads/logo", { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Upload échoué");
      }
      const { url } = (await res.json()) as { url: string };
      setLogoUrl(url); // preview immédiate
      toast({ title: "Logo téléversé", description: "Le logo a été mis à jour." });
      setFileToUpload(null);
    } catch (e: any) {
      toast({ title: "Échec de l’upload", description: e.message ?? "Impossible de téléverser le logo." });
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!name.trim()) {
      toast({ title: "Nom requis", description: "Le nom de la marque/projet est obligatoire." });
      return;
    }
    setSaving(true);
    const payload = {
      name: name.trim(),
      countryCode: country || null,
      city: city || null,
      websiteUrl: websiteUrl || null,
      description: description || null,
      aliases,
      logoUrl: logoUrl || null,
    };

    const res = await fetch(`/api/projects/${projectId}/brand`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast({ title: "Échec", description: j.error ?? "Impossible d'enregistrer." });
      return;
    }

    // Le serveur renvoie l'objet projet mis à jour → on le convertit en `base`
    const updated = await res.json();
    const newBase: InitialProject = {
      name: updated.name,
      countryCode: updated.countryCode,
      city: updated.city,
      websiteUrl: updated.websiteUrl,
      description: updated.description,
      aliasesJson: updated.aliasesJson ?? "[]",
      logoUrl: updated.logoUrl,
    };
    setBase(newBase); // ✅ la prochaine ouverture (ou si on ne ferme pas) reflètera la nouvelle vérité locale

    toast({
      title: "Modifications enregistrées",
      description: "Les informations de la marque ont été mises à jour.",
    });

    // Optionnel : on peut laisser le drawer ouvert si tu veux continuer l’édition
    setOpen(false);

    // Et on synchronise le Server Component (bloc “Résumé”, header, etc.)
    router.refresh();
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="rounded-xl border px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-zinc-800">
          Modifier les informations de la marque
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        <Dialog.Content
          className="
            fixed right-0 top-0 h-screen w-full max-w-[600px]
            bg-white p-4 shadow-xl outline-none
            dark:bg-zinc-900
            data-[state=open]:animate-in data-[state=closed]:animate-out
            data-[state=closed]:slide-out-to-right
            data-[state=open]:slide-in-from-right
          "
        >
          <div className="flex items-start justify-between">
            <Dialog.Title className="text-lg font-semibold">
              Modifier l’Analyse de Marque
            </Dialog.Title>
            <Dialog.Close className="rounded-full p-2 hover:bg-gray-100 dark:hover:bg-zinc-800">
              ✕
            </Dialog.Close>
          </div>

          <div className="mt-4 space-y-3 overflow-y-auto pr-2" style={{ maxHeight: "calc(100vh - 150px)" }}>
            {/* Nom */}
            <label className="block text-sm font-medium">Marque</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 dark:bg-zinc-900 dark:border-zinc-800"
            />

            {/* Pays */}
            <label className="block text-sm font-medium">Pays</label>
            <select
              value={country}
              onChange={(e) => {
                setCountry(e.target.value);
                setCity("");
              }}
              className="w-full rounded-xl border px-3 py-2 dark:bg-zinc-900 dark:border-zinc-800"
            >
              <option value="">—</option>
              {countries.map((c) => (
                <option key={c.isoCode} value={c.isoCode}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* Ville */}
            <label className="block text-sm font-medium">Ville</label>
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              disabled={!country}
              className="w-full rounded-xl border px-3 py-2 disabled:opacity-50 dark:bg-zinc-900 dark:border-zinc-800"
            >
              <option value="">—</option>
              {cities.map((ct) => (
                <option key={`${ct.name}-${ct.latitude}-${ct.longitude}`} value={ct.name}>
                  {ct.name}
                </option>
              ))}
            </select>

            {/* URL */}
            <label className="block text-sm font-medium">URL du site web (facultatif)</label>
            <input
              type="url"
              placeholder="https://exemple.com"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 dark:bg-zinc-900 dark:border-zinc-800"
            />

            {/* Description */}
            <label className="block text-sm font-medium">Description (facultatif)</label>
            <textarea
              rows={4}
              placeholder="Notes sur le projet, le public cible, les objectifs, etc."
              value={description ?? ""}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 dark:bg-zinc-900 dark:border-zinc-800"
            />

            {/* Alias */}
            <label className="block text-sm font-medium">Alias de la marque (facultatif)</label>
            <div className="flex gap-2">
              <input
                placeholder="Ajouter un nom de produit ou un alias"
                value={aliasInput}
                onChange={(e) => setAliasInput(e.target.value)}
                className="flex-1 rounded-xl border px-3 py-2 dark:bg-zinc-900 dark:border-zinc-800"
              />
              <button
                onClick={addAlias}
                className="rounded-xl border px-3 py-2 hover:bg-gray-50 dark:hover:bg-zinc-800"
              >
                Ajouter
              </button>
            </div>
            {!!aliases.length && (
              <div className="flex flex-wrap gap-2">
                {aliases.map((a) => (
                  <span
                    key={a}
                    className="inline-flex items-center gap-2 rounded-xl bg-gray-100 px-2 py-1 text-sm dark:bg-zinc-800"
                  >
                    {a}
                    <button
                      onClick={() => removeAlias(a)}
                      className="opacity-70 hover:opacity-100"
                      title="Retirer"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Logo */}
            <label className="block text-sm font-medium">Logo (facultatif)</label>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => setFileToUpload(e.target.files?.[0] ?? null)}
                  className="flex-1 rounded-xl border px-3 py-2 dark:bg-zinc-900 dark:border-zinc-800"
                />
                <button
                  onClick={handleUpload}
                  disabled={!fileToUpload || uploading}
                  className="rounded-xl border px-3 py-2 hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-50"
                >
                  {uploading ? "Téléversement…" : "Téléverser le logo"}
                </button>
              </div>

              <input
                placeholder="URL du logo (rempli automatiquement après upload)"
                value={logoUrl ?? ""}
                onChange={(e) => setLogoUrl(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 dark:bg-zinc-900 dark:border-zinc-800"
              />

              {logoUrl && (
                <img
                  src={logoUrl}
                  alt="Logo"
                  className="mt-2 h-20 w-20 rounded-lg object-contain border dark:border-zinc-800"
                />
              )}
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Dialog.Close className="rounded-xl border px-4 py-2 hover:bg-gray-50 dark:hover:bg-zinc-800">
              Annuler
            </Dialog.Close>
            <button
              onClick={save}
              disabled={saving}
              className="rounded-xl bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Enregistrement…" : "Enregistrer les modifications"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
