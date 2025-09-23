import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";

declare module "next-auth" {
    interface Session extends DefaultSession {
        user: DefaultSession["user"] & { id: string; role: "user" | "superadmin" };
    }
    interface User {
        id: string;
        role: "user" | "superadmin";
    }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
    providers: [
        Credentials({
            name: "Email & Password",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Mot de passe", type: "password" }
            },
            authorize: async (creds) => {
                if (!creds?.email || !creds?.password) return null;
                const user = await prisma.user.findUnique({ where: { email: creds.email } });
                if (!user) return null;
                const ok = await bcrypt.compare(creds.password, user.passwordHash);
                if (!ok) return null;
                return { id: user.id, email: user.email, name: user.name ?? "", role: user.role };
            }
        })
    ],
    session: { strategy: "jwt" },
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = (user as any).id;
                token.role = (user as any).role;
            }
            return token;
        },
        async session({ session, token }) {
            session.user = {
                ...session.user,
                id: token.id as string,
                role: token.role as "user" | "superadmin",
            };
            return session;
        }
    },
    pages: { signIn: "/" }, // ta page de login est '/'.
});
