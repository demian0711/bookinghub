CREATE TABLE "WorkDay" (
 "staffId" UUID NOT NULL REFERENCES "StaffProfile" ("userId") ON UPDATE CASCADE ON DELETE RESTRICT,
 "weekday" SMALLINT NOT NULL CHECK ("weekday" BETWEEN 1 AND 7),
 PRIMARY KEY ("staffId", "weekday")
);
CREATE TABLE "WorkShift" (
 "id" UUID PRIMARY KEY,
 "staffId" UUID NOT NULL,
 "weekday" SMALLINT NOT NULL,
 "startMinute" SMALLINT NOT NULL,
 "endMinute" SMALLINT NOT NULL,
 CHECK (0 <= "startMinute" AND "startMinute" < "endMinute" AND "endMinute" <= 1440),
 FOREIGN KEY ("staffId","weekday") REFERENCES "WorkDay" ("staffId","weekday") ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE UNIQUE INDEX "WorkShift_staffId_weekday_startMinute_key" ON "WorkShift" ("staffId","weekday","startMinute");
CREATE TABLE "ShiftBreak" (
 "shiftId" UUID NOT NULL REFERENCES "WorkShift" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
 "startMinute" SMALLINT NOT NULL,
 "endMinute" SMALLINT NOT NULL,
 CHECK (0 <= "startMinute" AND "startMinute" < "endMinute" AND "endMinute" <= 1440),
 PRIMARY KEY ("shiftId","startMinute")
);
CREATE TABLE "DayOff" (
 "staffId" UUID NOT NULL REFERENCES "StaffProfile" ("userId") ON UPDATE CASCADE ON DELETE RESTRICT,
 "date" DATE NOT NULL,
 PRIMARY KEY ("staffId","date")
);
