import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
    // For Turso remote databases, pass the auth token separately
    ...(process.env["DATABASE_AUTH_TOKEN"]
      ? { authToken: process.env["DATABASE_AUTH_TOKEN"] }
      : {}),
  },
});
