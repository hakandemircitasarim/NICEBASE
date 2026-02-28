-- Update Aiya message limit from 30 to 50 for all users
UPDATE "public"."users" 
SET "aiya_messages_limit" = 50 
WHERE "aiya_messages_limit" = 30;
