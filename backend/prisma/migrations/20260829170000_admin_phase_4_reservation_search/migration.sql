-- Admin analysis Phase 4 (ADM-02): the reservation list becomes searchable and
-- filterable server-side. These indexes support the default ordering and the two
-- filters an operator reaches for first.
CREATE INDEX "Reservation_status_startAt_idx" ON "Reservation"("status", "startAt");
CREATE INDEX "Reservation_createdAt_idx" ON "Reservation"("createdAt");
