CREATE TYPE "Role" AS ENUM ('CUSTOMER','STAFF','ADMIN');
CREATE TABLE "User" (
  "id" UUID PRIMARY KEY,
  "email" VARCHAR(254) NOT NULL UNIQUE CHECK ("email" = lower(btrim("email"))),
  "displayName" VARCHAR(100) NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" "Role" NOT NULL DEFAULT 'CUSTOMER',
  "active" BOOLEAN NOT NULL DEFAULT true
);
CREATE TABLE "Session" (
  "tokenHash" CHAR(64) PRIMARY KEY,
  "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "revokedAt" TIMESTAMPTZ(3)
);
CREATE INDEX "Session_userId_idx" ON "Session" ("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session" ("expiresAt");
