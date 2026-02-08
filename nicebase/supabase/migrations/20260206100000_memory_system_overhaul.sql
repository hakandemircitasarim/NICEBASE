-- ============================================================
-- Memory System Overhaul Migration
-- 1. Relax category / life_area constraints on memories
-- 2. Add daily_questions table
-- 3. Add daily_question_answers table
-- ============================================================

-- 1a. Drop old category CHECK and add a permissive one that includes 'uncategorized'
ALTER TABLE public.memories
  DROP CONSTRAINT IF EXISTS memories_category_check;

ALTER TABLE public.memories
  ALTER COLUMN category SET DEFAULT 'uncategorized';

-- We keep a loose constraint so garbage data doesn't sneak in,
-- but we now accept 'uncategorized' as the initial AI-pending value.
ALTER TABLE public.memories
  ADD CONSTRAINT memories_category_check
  CHECK (
    category = ANY (
      ARRAY[
        'uncategorized'::text,
        'success'::text,
        'peace'::text,
        'fun'::text,
        'love'::text,
        'gratitude'::text,
        'inspiration'::text,
        'growth'::text,
        'adventure'::text
      ]
    )
  );

-- 1b. Drop old life_area CHECK and add a permissive one
ALTER TABLE public.memories
  DROP CONSTRAINT IF EXISTS memories_life_area_check;

ALTER TABLE public.memories
  ALTER COLUMN life_area SET DEFAULT 'uncategorized';

ALTER TABLE public.memories
  ADD CONSTRAINT memories_life_area_check
  CHECK (
    life_area = ANY (
      ARRAY[
        'uncategorized'::text,
        'personal'::text,
        'work'::text,
        'relationship'::text,
        'family'::text,
        'friends'::text,
        'hobby'::text,
        'travel'::text,
        'health'::text
      ]
    )
  );

-- ============================================================
-- 2. Daily Questions table
-- One row per day; same question for all users on that date.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.daily_questions (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  question_tr TEXT NOT NULL,
  question_en TEXT NOT NULL,
  date DATE NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.daily_questions ENABLE ROW LEVEL SECURITY;

-- Everyone (authenticated) can read daily questions
CREATE POLICY "Anyone can read daily questions"
  ON public.daily_questions FOR SELECT
  USING (true);

-- Only service_role / admin inserts questions (no user INSERT policy)

-- Index for fast lookup by date
CREATE INDEX IF NOT EXISTS daily_questions_date_idx ON public.daily_questions(date);

-- ============================================================
-- 3. Daily Question Answers table
-- Stores each user's answer to a daily question.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.daily_question_answers (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.daily_questions(id) ON DELETE CASCADE,
  answer_text TEXT NOT NULL,
  memory_id UUID REFERENCES public.memories(id) ON DELETE SET NULL,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.daily_question_answers ENABLE ROW LEVEL SECURITY;

-- Users can read their own answers
CREATE POLICY "Users can read own answers"
  ON public.daily_question_answers FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own answers
CREATE POLICY "Users can insert own answers"
  ON public.daily_question_answers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Future: public answers readable by everyone
CREATE POLICY "Anyone can read public answers"
  ON public.daily_question_answers FOR SELECT
  USING (is_public = true);

-- Indexes
CREATE INDEX IF NOT EXISTS dqa_user_id_idx ON public.daily_question_answers(user_id);
CREATE INDEX IF NOT EXISTS dqa_question_id_idx ON public.daily_question_answers(question_id);

-- ============================================================
-- 4. Seed initial daily questions (30 days worth)
-- ============================================================
INSERT INTO public.daily_questions (question_tr, question_en, date) VALUES
  ('Bugün neye şükrettin?', 'What are you grateful for today?', CURRENT_DATE),
  ('Bu hafta seni en çok ne güldürdü?', 'What made you laugh the most this week?', CURRENT_DATE + INTERVAL '1 day'),
  ('Son zamanlarda hangi başarını kutlamak istersin?', 'What recent achievement would you like to celebrate?', CURRENT_DATE + INTERVAL '2 days'),
  ('Bugün seni mutlu eden küçük bir şey neydi?', 'What small thing made you happy today?', CURRENT_DATE + INTERVAL '3 days'),
  ('Hayatında kime teşekkür etmek istersin?', 'Who in your life would you like to thank?', CURRENT_DATE + INTERVAL '4 days'),
  ('Son zamanlarda öğrendiğin yeni bir şey neydi?', 'What is something new you learned recently?', CURRENT_DATE + INTERVAL '5 days'),
  ('Kendini en huzurlu hissettiğin an hangisiydi?', 'When was the last time you felt truly at peace?', CURRENT_DATE + INTERVAL '6 days'),
  ('Bugün birini nasıl mutlu ettin?', 'How did you make someone happy today?', CURRENT_DATE + INTERVAL '7 days'),
  ('En sevdiğin çocukluk anın hangisi?', 'What is your favorite childhood memory?', CURRENT_DATE + INTERVAL '8 days'),
  ('Hayatındaki en değerli ilişki hangisi?', 'What is the most valuable relationship in your life?', CURRENT_DATE + INTERVAL '9 days'),
  ('Bugün kendine nasıl iyi baktın?', 'How did you take care of yourself today?', CURRENT_DATE + INTERVAL '10 days'),
  ('Seni en çok heyecanlandıran gelecek planın ne?', 'What future plan excites you the most?', CURRENT_DATE + INTERVAL '11 days'),
  ('Son zamanlarda seni gururlandıran bir şey ne?', 'What is something that made you proud recently?', CURRENT_DATE + INTERVAL '12 days'),
  ('Favori mekanında en son ne zaman vakit geçirdin?', 'When was the last time you spent time at your favorite place?', CURRENT_DATE + INTERVAL '13 days'),
  ('Bugün doğada güzel bir şey fark ettin mi?', 'Did you notice something beautiful in nature today?', CURRENT_DATE + INTERVAL '14 days'),
  ('En son ne zaman kahkaha attın?', 'When was the last time you laughed out loud?', CURRENT_DATE + INTERVAL '15 days'),
  ('Hayatında seni ilham veren kim var?', 'Who in your life inspires you?', CURRENT_DATE + INTERVAL '16 days'),
  ('Bu ay kendini geliştirmek için ne yaptın?', 'What did you do to improve yourself this month?', CURRENT_DATE + INTERVAL '17 days'),
  ('En sevdiğin yemek ve onunla bağlantılı bir anın var mı?', 'What is your favorite food and do you have a memory associated with it?', CURRENT_DATE + INTERVAL '18 days'),
  ('Bugün beklentilerini aşan bir şey oldu mu?', 'Did anything exceed your expectations today?', CURRENT_DATE + INTERVAL '19 days'),
  ('Son zamanlarda okuduğun veya izlediğin en etkileyici şey ne?', 'What is the most impactful thing you read or watched recently?', CURRENT_DATE + INTERVAL '20 days'),
  ('Hayatında basit ama çok değerli bir ritüelin var mı?', 'Do you have a simple but valuable ritual in your life?', CURRENT_DATE + INTERVAL '21 days'),
  ('Bir arkadaşınla en son ne zaman kaliteli vakit geçirdin?', 'When was the last time you spent quality time with a friend?', CURRENT_DATE + INTERVAL '22 days'),
  ('Kendini en güçlü hissettiğin an hangisiydi?', 'When did you feel the strongest?', CURRENT_DATE + INTERVAL '23 days'),
  ('Bugün seni şaşırtan bir şey oldu mu?', 'Was there anything that surprised you today?', CURRENT_DATE + INTERVAL '24 days'),
  ('Ailenle paylaştığın en güzel gelenek ne?', 'What is the best tradition you share with your family?', CURRENT_DATE + INTERVAL '25 days'),
  ('Hayatında değiştirmek istediğin bir alışkanlık var mı?', 'Is there a habit you would like to change in your life?', CURRENT_DATE + INTERVAL '26 days'),
  ('Son zamanlarda cesaret ettiğin bir şey neydi?', 'What is something you were brave enough to do recently?', CURRENT_DATE + INTERVAL '27 days'),
  ('Bugün küçük bir macera yaşadın mı?', 'Did you have a small adventure today?', CURRENT_DATE + INTERVAL '28 days'),
  ('Gelecekte hatırlamak istediğin bugünkü bir an var mı?', 'Is there a moment from today you want to remember in the future?', CURRENT_DATE + INTERVAL '29 days')
ON CONFLICT (date) DO NOTHING;

-- Grant permissions
GRANT ALL ON TABLE public.daily_questions TO anon;
GRANT ALL ON TABLE public.daily_questions TO authenticated;
GRANT ALL ON TABLE public.daily_questions TO service_role;

GRANT ALL ON TABLE public.daily_question_answers TO anon;
GRANT ALL ON TABLE public.daily_question_answers TO authenticated;
GRANT ALL ON TABLE public.daily_question_answers TO service_role;
