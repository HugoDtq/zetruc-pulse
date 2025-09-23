'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function NewProjectForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);

    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    });

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error ?? 'Erreur');
      setLoading(false);
      return;
    }

    setName('');
    router.refresh(); // recharge la liste
  }

  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nom du projet"
        className="w-64 rounded-xl border bg-white px-3 py-2 text-sm outline-none ring-offset-2 focus:ring-2
                   dark:bg-zinc-900 dark:border-zinc-800"
        required
        minLength={2}
      />
      <button
        type="submit"
        disabled={loading}
        className="rounded-xl bg-gray-900 px-4 py-2 text-white hover:bg-black disabled:opacity-50"
      >
        {loading ? 'Ajout…' : 'Ajouter'}
      </button>
      {err && <span className="text-sm text-red-500">{err}</span>}
    </form>
  );
}
