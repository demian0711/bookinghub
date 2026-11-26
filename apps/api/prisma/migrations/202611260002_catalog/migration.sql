CREATE UNIQUE INDEX "User_id_role_key" ON "User" ("id","role");

CREATE TABLE "Service" (
 "id" UUID PRIMARY KEY,
 "name" VARCHAR(120) NOT NULL CHECK (length(trim("name")) > 0),
 "description" VARCHAR(1000) NOT NULL,
 "priceVnd" INTEGER NOT NULL CHECK ("priceVnd" BETWEEN 0 AND 10000000),
 "durationMinutes" INTEGER NOT NULL CHECK ("durationMinutes" BETWEEN 1 AND 480),
 "active" BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX "Service_active_name_id_idx" ON "Service" ("active","name","id");

-- Khóa ngoại ghép buộc tài khoản của hồ sơ luôn có vai trò STAFF.
CREATE TABLE "StaffProfile" (
 "userId" UUID PRIMARY KEY,
 "role" "Role" NOT NULL DEFAULT 'STAFF' CHECK ("role" = 'STAFF'),
 "bio" VARCHAR(1000) NOT NULL DEFAULT '',
 FOREIGN KEY ("userId","role") REFERENCES "User" ("id","role") ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE UNIQUE INDEX "StaffProfile_userId_role_key" ON "StaffProfile" ("userId","role");
INSERT INTO "StaffProfile" ("userId") SELECT "id" FROM "User" WHERE "role"='STAFF';

CREATE TABLE "StaffService" (
 "staffId" UUID NOT NULL REFERENCES "StaffProfile" ("userId") ON DELETE RESTRICT ON UPDATE CASCADE,
 "serviceId" UUID NOT NULL REFERENCES "Service" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 PRIMARY KEY ("staffId","serviceId")
);
CREATE INDEX "StaffService_serviceId_staffId_idx" ON "StaffService" ("serviceId","staffId");
