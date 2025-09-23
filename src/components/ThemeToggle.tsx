'use client';

import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
    const { theme, setTheme, systemTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);
    if (!mounted) return null;

    const current = theme === 'system' ? systemTheme : theme;
    const next = current === 'dark' ? 'light' : 'dark';

    return (
        <button
            onClick={() => setTheme(next!)}
            className="inline-flex items-center gap-2 rounded-xl border px-3 py-1 text-sm
                 hover:bg-gray-50 dark:hover:bg-zinc-800
                 border-gray-200 dark:border-zinc-700"
            aria-label="Basculer le thème"
        >
            {current === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            <span>{current === 'dark' ? 'Mode clair' : 'Mode sombre'}</span>
        </button>
    );
}
