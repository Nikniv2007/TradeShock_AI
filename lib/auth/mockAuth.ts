// ─────────────────────────────────────────────────────────────
// Placeholder, Supabase-auth-READY structure (§23).
//
// The demo ships with a mock session so the app is usable with no auth
// backend. The shape mirrors a Supabase `User`/`Session` so wiring real
// auth later is a drop-in: replace getSession() with a Supabase call and
// keep the same MockUser/MockSession contract across the app.
//
// NOTE: This is NOT real authentication. Do not gate sensitive data on it.
// ─────────────────────────────────────────────────────────────

export interface MockUser {
  id: string;
  email: string;
  name: string;
  role: "owner" | "cfo" | "supply_chain" | "analyst" | "viewer";
  companyId: string;
  avatarInitials: string;
}

export interface MockSession {
  user: MockUser;
  authenticated: boolean;
  provider: "demo" | "supabase";
  expiresAt: string | null;
}

const DEMO_USER: MockUser = {
  id: "demo-user-1",
  email: "founder@harborandpine.example",
  name: "Harbor & Pine (Demo)",
  role: "owner",
  companyId: "co-1",
  avatarInitials: "HP",
};

/**
 * Returns the current session. In demo mode this is always a fictional user.
 * To enable real auth, swap the body for a Supabase `getSession()` call:
 *
 *   const { data } = await supabase.auth.getSession();
 *   return data.session ? mapSupabaseSession(data.session) : signedOut();
 */
export function getSession(): MockSession {
  return {
    user: DEMO_USER,
    authenticated: true,
    provider: "demo",
    expiresAt: null,
  };
}

export function signedOut(): MockSession {
  return {
    user: { ...DEMO_USER, name: "Guest", role: "viewer", avatarInitials: "G" },
    authenticated: false,
    provider: "demo",
    expiresAt: null,
  };
}

/** Whether a real auth backend (Supabase) is configured via env. */
export function isAuthConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** Simple role-gate helper for future authorization checks. */
export function can(session: MockSession, action: "edit" | "view" | "approve_po"): boolean {
  if (!session.authenticated) return action === "view";
  const role = session.user.role;
  if (action === "approve_po") return role === "owner" || role === "cfo";
  if (action === "edit") return role !== "viewer";
  return true;
}
