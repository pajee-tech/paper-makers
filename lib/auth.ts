import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Email",
      credentials: { email: { label: "Email", type: "email" }, password: { label: "Password", type: "password" } },
      async authorize(creds) {
        const email = creds?.email?.toLowerCase().trim();
        if (!email || !creds?.password) return null;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;
        const ok = await bcrypt.compare(creds.password, user.passwordHash);
        if (!ok) return null;
        return { id: user.id, name: user.name, email: user.email, role: user.role, institutionId: user.institutionId };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = user.role;
        token.institutionId = user.institutionId ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.role = token.role as string;
        session.user.institutionId = (token.institutionId as string | null) ?? null;
      }
      return session;
    },
  },
};

export async function getSession() {
  return getServerSession(authOptions);
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Use in API routes: returns the user + institutionId or throws 401. */
export async function requireUser() {
  const s = await getSession();
  if (!s?.user?.id) throw new HttpError(401, "Please sign in");
  return s.user;
}

export async function requireInstitutionUser() {
  const u = await requireUser();
  if (!u.institutionId) throw new HttpError(403, "No institution linked to this account");
  return u as typeof u & { institutionId: string };
}

export async function requireSuperAdmin() {
  const u = await requireUser();
  if (u.role !== "SUPER_ADMIN") throw new HttpError(403, "Super Admin only");
  return u;
}
