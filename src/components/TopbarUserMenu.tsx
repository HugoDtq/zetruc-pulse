'use client';

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';

type Props = {
    user: {
        email?: string | null;
    };
};

export function TopbarUserMenu({ user }: Props) {
    const router = useRouter();
    const initial = (user.email?.[0] || 'U').toUpperCase();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger className="outline-none">
                <Avatar className="h-8 w-8">
                    <AvatarFallback>{initial}</AvatarFallback>
                </Avatar>
            </DropdownMenuTrigger>

            <DropdownMenuContent
                align="end"
                className="w-56 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800"
            >
                <DropdownMenuLabel>
                    Connecté en tant que
                    <div className="truncate text-sm font-medium">{user.email ?? 'Inconnu'}</div>
                </DropdownMenuLabel>

                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={() => router.push('/settings')}>
                    Paramètres du compte
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                    className="text-red-600 dark:text-red-400 focus:text-red-700 dark:focus:text-red-500"
                    onClick={() => signOut({ callbackUrl: '/' })}
                >
                    Se déconnecter
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
