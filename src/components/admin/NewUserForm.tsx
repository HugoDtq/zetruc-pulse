'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useToast } from '@/components/ui/use-toast';

export default function NewUserForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [group, setGroup] = useState<'ADMINISTRATEUR'|'AGENCE'|'UTILISATEUR'>('UTILISATEUR');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, name, password, group }),
    });
    setLoading(false);

    if (!res.ok) {
      const j = await res.json().catch(()=>({}));
      toast({ title: 'Création échouée', description: j.error ?? 'Erreur inconnue' });
      return;
    }

    toast({ title: 'Utilisateur créé', description: email });
    setEmail(''); setName(''); setPassword(''); setGroup('UTILISATEUR');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-2">
      <input className="rounded-xl border px-3 py-2 text-sm dark:bg-zinc-900 dark:border-zinc-800" placeholder="Email"
             value={email} onChange={e=>setEmail(e.target.value)} required />
      <input className="rounded-xl border px-3 py-2 text-sm dark:bg-zinc-900 dark:border-zinc-800" placeholder="Nom"
             value={name} onChange={e=>setName(e.target.value)} />
      <select className="rounded-xl border px-3 py-2 text-sm dark:bg-zinc-900 dark:border-zinc-800"
              value={group} onChange={e=>setGroup(e.target.value as any)}>
        <option value="UTILISATEUR">Utilisateur</option>
        <option value="AGENCE">Agence</option>
        <option value="ADMINISTRATEUR">Administrateur</option>
      </select>
      <input className="rounded-xl border px-3 py-2 text-sm dark:bg-zinc-900 dark:border-zinc-800" placeholder="Mot de passe"
             value={password} onChange={e=>setPassword(e.target.value)} type="password" required minLength={6}/>
      <button type="submit" disabled={loading}
              className="rounded-xl bg-gray-900 px-4 py-2 text-white hover:bg-black disabled:opacity-50">
        {loading ? 'Création…' : 'Créer'}
      </button>
      {err && <span className="text-sm text-red-600">{err}</span>}
    </form>
  );
}
