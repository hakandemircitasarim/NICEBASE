-- Expand allowed values for `public.memories.category` to match frontend categories.
-- Frontend supports: success, peace, fun, love, gratitude, inspiration, growth, adventure

ALTER TABLE public.memories
  DROP CONSTRAINT IF EXISTS memories_category_check;

ALTER TABLE public.memories
  ADD CONSTRAINT memories_category_check
  CHECK (
    category = ANY (
      ARRAY[
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


