BEGIN;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE TYPE "AppointmentStatus" AS ENUM ('PENDING','CONFIRMED','CANCELLED','COMPLETED','NO_SHOW');

CREATE TABLE "Appointment" (
  "id" uuid PRIMARY KEY,
  "customerId" uuid NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "staffId" uuid NOT NULL REFERENCES "StaffProfile"("userId") ON DELETE RESTRICT ON UPDATE CASCADE,
  "serviceId" uuid NOT NULL REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "startAt" timestamptz(3) NOT NULL, "endAt" timestamptz(3) NOT NULL,
  "serviceName" varchar(120) NOT NULL,
  "priceVnd" integer NOT NULL CHECK ("priceVnd" BETWEEN 0 AND 10000000),
  "durationMinutes" integer NOT NULL CHECK ("durationMinutes" BETWEEN 1 AND 480),
  "status" "AppointmentStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ("endAt" = "startAt" + "durationMinutes" * interval '1 minute'),
  CONSTRAINT appointment_staff_held_excl EXCLUDE USING gist
    ("staffId" WITH =, tstzrange("startAt","endAt",'[)') WITH &&)
    WHERE ("status" IN ('PENDING','CONFIRMED'))
);
CREATE INDEX "Appointment_staffId_startAt_idx" ON "Appointment" ("staffId","startAt");
CREATE INDEX "Appointment_customerId_startAt_idx" ON "Appointment" ("customerId","startAt");

CREATE TABLE "AppointmentEvent" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "appointmentId" uuid NOT NULL REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "actorId" uuid NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "previousStatus" "AppointmentStatus",
  "status" "AppointmentStatus" NOT NULL,
  "occurredAt" timestamptz(3) NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX "AppointmentEvent_appointmentId_occurredAt_idx" ON "AppointmentEvent" ("appointmentId","occurredAt");

-- Sự kiện thuộc cùng giao dịch với lịch. Khi đổi trạng thái, actor phải do backend đặt trong giao dịch.
CREATE FUNCTION bookinghub_record_status() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO "AppointmentEvent" ("appointmentId","actorId","status") VALUES (NEW.id, NEW."customerId", NEW.status);
  ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO "AppointmentEvent" ("appointmentId","actorId","previousStatus","status")
    VALUES (NEW.id, NULLIF(current_setting('bookinghub.actor_id',true),'')::uuid, OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER appointment_record_status AFTER INSERT OR UPDATE OF status ON "Appointment"
FOR EACH ROW EXECUTE FUNCTION bookinghub_record_status();
COMMIT;
