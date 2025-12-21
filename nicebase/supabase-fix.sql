-- Bu dosyayı Supabase SQL Editor'da çalıştır

-- Önce mevcut trigger'ı sil (varsa)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Function: Yeni kullanıcı oluşturulduğunda users tablosuna ekle
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, is_premium, aiya_messages_used, aiya_messages_limit, weekly_summary_day, daily_reminder_time, language, theme, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    FALSE,
    0,
    30,
    NULL,
    NULL,
    'tr',
    'light',
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: auth.users'a yeni kullanıcı eklendiğinde çalışsın
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Eğer zaten kayıtlı kullanıcılar varsa, onları da ekle
INSERT INTO public.users (id, email, is_premium, aiya_messages_used, aiya_messages_limit, weekly_summary_day, daily_reminder_time, language, theme, created_at)
SELECT 
  id,
  email,
  FALSE,
  0,
  30,
  NULL,
  NULL,
  'tr',
  'light',
  created_at
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.users)
ON CONFLICT (id) DO NOTHING;











