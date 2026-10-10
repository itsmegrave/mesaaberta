-- Additive (expand step): a nullable column that nothing reads yet.
ALTER TABLE "events" ADD COLUMN "claim_token" uuid;