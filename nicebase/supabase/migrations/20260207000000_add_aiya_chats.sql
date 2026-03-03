-- Drop old table if it exists (had wrong schema with chats_json)
DROP TABLE IF EXISTS "public"."aiya_chats" CASCADE;

-- Create aiya_chats table for syncing Aiya conversations (per-chat rows)
CREATE TABLE "public"."aiya_chats" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" text NOT NULL DEFAULT '',
    "messages" "jsonb" NOT NULL DEFAULT '[]'::jsonb,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "aiya_chats_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "public"."aiya_chats" OWNER TO "postgres";

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS "aiya_chats_user_id_idx" ON "public"."aiya_chats" ("user_id");

-- Enable RLS
ALTER TABLE "public"."aiya_chats" ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own chats
CREATE POLICY "Users can view own aiya chats"
    ON "public"."aiya_chats"
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own aiya chats"
    ON "public"."aiya_chats"
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own aiya chats"
    ON "public"."aiya_chats"
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own aiya chats"
    ON "public"."aiya_chats"
    FOR DELETE
    USING (auth.uid() = user_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_aiya_chats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on update
CREATE TRIGGER update_aiya_chats_updated_at
    BEFORE UPDATE ON "public"."aiya_chats"
    FOR EACH ROW
    EXECUTE FUNCTION update_aiya_chats_updated_at();
