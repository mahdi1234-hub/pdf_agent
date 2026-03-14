import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  providers: [
    CredentialsProvider({
      name: "OTP",
      credentials: {
        email: { label: "Email", type: "email" },
        code: { label: "OTP Code", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.code) return null;

        const otp = await prisma.otpCode.findFirst({
          where: {
            email: credentials.email,
            code: credentials.code,
            used: false,
            expires: { gt: new Date() },
          },
        });

        if (!otp) return null;

        await prisma.otpCode.update({
          where: { id: otp.id },
          data: { used: true },
        });

        let user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) {
          user = await prisma.user.create({
            data: {
              email: credentials.email,
              emailVerified: new Date(),
            },
          });

          await prisma.activity.create({
            data: {
              type: "SIGNUP",
              details: `User signed up with email: ${credentials.email}`,
              userId: user.id,
            },
          });
        } else {
          await prisma.activity.create({
            data: {
              type: "LOGIN",
              details: `User logged in with OTP`,
              userId: user.id,
            },
          });
        }

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id: string }).id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/login",
  },
};
