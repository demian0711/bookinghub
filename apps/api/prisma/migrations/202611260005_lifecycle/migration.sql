BEGIN;
ALTER TABLE "AppointmentEvent" ADD COLUMN "reason" varchar(500);
-- Actor và lý do hủy chỉ có hiệu lực trong giao dịch cập nhật trạng thái.
CREATE OR REPLACE FUNCTION bookinghub_record_status() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO "AppointmentEvent" ("appointmentId","actorId","status") VALUES (NEW.id, NEW."customerId", NEW.status);
  ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO "AppointmentEvent" ("appointmentId","actorId","previousStatus","status","reason")
    VALUES (NEW.id, NULLIF(current_setting('bookinghub.actor_id',true),'')::uuid, OLD.status, NEW.status, NULLIF(current_setting('bookinghub.cancel_reason',true),''));
  END IF;
  RETURN NEW;
END;
$$;
COMMIT;
