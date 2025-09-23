export type Role = 'user' | 'superadmin';
export const canSeeSuperadmin = (role?: Role) => role === 'superadmin';
