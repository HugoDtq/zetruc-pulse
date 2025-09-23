import NextAuth from "next-auth";
import { authOptions } from "@/lib/authOptions";

export const runtime = "nodejs";     // 👈 force Node runtime

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
