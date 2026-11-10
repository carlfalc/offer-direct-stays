-- Traveller phone is compulsory + profile self-heal. Run once in the Supabase SQL editor.

-- 1) Let a user create/repair their OWN profile row (fixes "violates row-level security policy for table profiles").
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 2) New signups: copy phone from signup metadata into the profile.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, first_name, last_name, phone)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name',
    NULLIF(NEW.raw_user_meta_data ->> 'phone', '')
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'guest');

  RETURN NEW;
END;
$$;

-- 3) Backfill: any auth user missing a profile row gets one.
INSERT INTO public.profiles (user_id, email, first_name, last_name, phone)
SELECT u.id, u.email, u.raw_user_meta_data ->> 'first_name', u.raw_user_meta_data ->> 'last_name',
       NULLIF(u.raw_user_meta_data ->> 'phone', '')
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = u.id);

NOTIFY pgrst, 'reload schema';
