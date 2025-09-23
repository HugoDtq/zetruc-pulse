import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname, origin } = req.nextUrl;

  // Cookie NextAuth v4 (dev)
  const hasSession =
    req.cookies.get('next-auth.session-token') ||
    req.cookies.get('__Secure-next-auth.session-token');

  // Protège /dashboard et /projects
  if ((pathname.startsWith('/dashboard') || pathname.startsWith('/projects')) && !hasSession) {
    return NextResponse.redirect(new URL('/', origin));
  }

  // Protège /superadmin (ex: simple check côté client/serveur ensuite)
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/projects/:path*', '/superadmin/:path*'],
};
