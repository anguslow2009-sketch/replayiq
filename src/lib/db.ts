import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

function createPrismaClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  // Local SQLite: file:./dev.db — convert to libsql file URL
  // Remote Turso: libsql://... with separate DATABASE_AUTH_TOKEN
  const libsqlUrl = url.startsWith("file:") ? url : url;
  const authToken = process.env.DATABASE_AUTH_TOKEN;

  const adapter = new PrismaLibSql({ url: libsqlUrl, authToken });
  return new PrismaClient({ adapter, log: ["error"] });
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
