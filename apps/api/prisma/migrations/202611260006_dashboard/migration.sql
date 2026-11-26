-- Lọc theo ngày hẹn toàn salon và giữ thứ tự ổn định khi phân trang.
CREATE INDEX "Appointment_startAt_id_idx" ON "Appointment" ("startAt","id");
