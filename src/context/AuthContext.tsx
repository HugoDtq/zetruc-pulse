'use client';

import { createContext, useContext, ReactNode } from 'react';
import { SessionProvider, useSession } from 'next-auth/react';
import type { Session } from 'next-auth';

/**
 * On définit un type simple qui reflète ce que renvoie NextAuth
 */
type AuthContextType = {
    session: Session | null;
    status: 'loading' | 'authenticated' | 'unauthenticated';
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Provider qui englobe le SessionProvider de NextAuth
 */
export function AuthProvider({ children }: { children: ReactNode }) {
    return (
        <SessionProvider>
            <InnerAuthProvider>{children}</InnerAuthProvider>
        </SessionProvider>
    );
}

/**
 * Provider interne pour exposer session + status dans notre contexte
 */
function InnerAuthProvider({ children }: { children: ReactNode }) {
    const { data: session, status } = useSession();

    return (
        <AuthContext.Provider value={{ session: session ?? null, status }}>
            {children}
        </AuthContext.Provider>
    );
}

/**
 * Hook custom pour récupérer la session et le status partout
 */
export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error('useAuth must be used inside <AuthProvider>');
    }
    return ctx;
}
