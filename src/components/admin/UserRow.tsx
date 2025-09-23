'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/use-toast';

export type Group = 'ADMINISTRATEUR' | 'AGENCE' | 'UTILISATEUR';

type Props = {
  id: string;
  email: string;
  group: Group;
  selfId?: string;        // 👈 id de l’utilisateur courant pour griser le bouton
};

export default function UserRow({ id, email, group, selfId }: Props) {
  const router = useRouter();
  const { toast } = useToast();

  const [pwd, setPwd] = useState('');
  const [grp, setGrp] = useState<Group>(group);
  const [busyPwd, setBusyPwd] = useState(false);
  const [busyGrp, setBusyGrp] = useState(false);
  const [busyDel, setBusyDel] = useState(false);

  async function changeGroup(newGroup: Group) {
    setGrp(newGroup);
    setBusyGrp(true);
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ group: newGroup }),
    });
    setBusyGrp(false);
    if (!res.ok) {
      toast({ title: 'Échec mise à jour', description: 'Groupe non modifié' });
      router.refresh();
      return;
    }
    toast({ title: 'Groupe modifié', description: `${email} → ${newGroup}` });
  }

  async function changePassword() {
    if (pwd.length < 6) {
      toast({ title: 'Mot de passe trop court', description: 'Minimum 6 caractères' });
      return;
    }
    setBusyPwd(true);
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: pwd }),
    });
    setBusyPwd(false);
    if (!res.ok) {
      toast({ title: 'Échec mise à jour', description: 'Mot de passe non modifié' });
      return;
    }
    setPwd('');
    toast({ title: 'Mot de passe mis à jour', description: email });
  }

  async function removeUser() {
    // confirm "custom" via toast + re-click
    const key = Math.random().toString(36).slice(2);
    toast({
      title: 'Confirmer la suppression ?',
      description: (
        <div className="mt-2 flex gap-2">
          <button
            onClick={async () => {
              setBusyDel(true);
              const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
              setBusyDel(false);
              if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                toast({ title: 'Suppression échouée', description: j.error ?? 'Erreur inconnue' });
                return;
              }
              toast({ title: 'Utilisateur supprimé', description: email });
              router.refresh();
            }}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-white hover:bg-red-700"
          >
            Supprimer
          </button>
          <button
            onClick={() => {/* rien : toast disparaîtra */}}
            className="rounded-lg border px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-zinc-800"
          >
            Annuler
          </button>
        </div>
      ) as any,
    });
  }

  return (
    <tr className="border-t border-gray-200 dark:border-zinc-700">
      <td className="px-4 py-2">{email}</td>

      <td className="px-4 py-2">
        <select
          value={grp}
          onChange={(e) => changeGroup(e.target.value as Group)}
          disabled={busyGrp}
          className="rounded-lg border border-gray-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="UTILISATEUR">Utilisateur</option>
          <option value="AGENCE">Agence</option>
          <option value="ADMINISTRATEUR">Administrateur</option>
        </select>
      </td>

      <td className="px-4 py-2">
        <div className="flex items-center gap-2">
          <input
            type="password"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            placeholder="••••••"
            className="w-48 rounded-lg border border-gray-300 px-3 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            onClick={changePassword}
            disabled={busyPwd || !pwd}
            className="rounded-lg border px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-50"
          >
            {busyPwd ? '…' : 'Changer MDP'}
          </button>
        </div>
      </td>

      <td className="px-4 py-2 text-right">
        <button
          onClick={removeUser}
          disabled={busyDel || selfId === id}
          title={selfId === id ? "Vous ne pouvez pas vous supprimer" : undefined}
          className="rounded-lg bg-red-600 px-3 py-1.5 text-white hover:bg-red-700 disabled:opacity-50"
        >
          {busyDel ? '…' : 'Supprimer'}
        </button>
      </td>
    </tr>
  );
}
