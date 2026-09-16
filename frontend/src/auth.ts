import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import prisma from "@/shared/libs/Prisma";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID!,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET!,
      issuer: `https://login.microsoftonline.com/${process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID}/v2.0`,
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        // Dev mock credentials bypass for local development
        if (credentials.username === "dev" && credentials.password === "dev") {
          return { id: "1", name: "Developer", email: "dev@ingenero.com" };
        }

        const user = await prisma.user.findFirst({
          where: { userName: credentials.username as string }
        });

        if (!user || !user.isActive) return null;

        // Skip bcrypt if password string is empty (e.g. Entra ID only users)
        if (!user.userPassword) return null;

        const passwordsMatch = await bcrypt.compare(credentials.password as string, user.userPassword);

        if (passwordsMatch) {
          // Return user object compatible with NextAuth
          return { id: String(user.userId), name: user.userName, email: user.userEmail };
        }

        return null;
      }
    })
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "microsoft-entra-id") {
        if (!user.email) return false;

        // Map Entra ID user to our internal DB user
        let dbUser = await prisma.user.findFirst({
          where: { userEmail: user.email }
        });

        if (!dbUser) {
          dbUser = await prisma.user.create({
            data: {
              userName: user.name || user.email.split("@")[0],
              userEmail: user.email,
              userPassword: "", // No local password
              isActive: true,
            }
          });
        } else if (!dbUser.isActive) {
          return false; // Prevent login if account is deactivated
        }

        // Override NextAuth user ID with our database ID so the session contains our internal integer ID
        user.id = String(dbUser.userId);
        return true;
      }

      // For CredentialsProvider, authorize() already checks DB
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        // This is called upon sign in. Assign the DB id to the token.
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        // Ensure the session user ID is our internal DB ID
        session.user.id = token.id as string;
      }
      return session;
    }
  }
});