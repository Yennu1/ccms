-- Add onboarding wizard columns to organisations
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS denomination TEXT;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS church_size TEXT;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS post_code TEXT;

-- Add church_role to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS church_role TEXT;

-- Recreate setup_new_organisation RPC with all onboarding parameters
CREATE OR REPLACE FUNCTION public.setup_new_organisation(
  p_org_name TEXT,
  p_denomination TEXT DEFAULT NULL,
  p_church_size TEXT DEFAULT NULL,
  p_logo_url TEXT DEFAULT NULL,
  p_country TEXT DEFAULT 'Ghana',
  p_city TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_post_code TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_church_role TEXT DEFAULT NULL,
  p_first_name TEXT DEFAULT NULL,
  p_last_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    UUID;
  v_org_id     UUID;
  v_branch_id  UUID;
  v_slug       TEXT;
  v_email      TEXT;
  v_full_name  TEXT;
  v_profile_exists BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF EXISTS (SELECT 1 FROM user_roles WHERE user_id = v_user_id) THEN
    RAISE EXCEPTION 'User already belongs to an organisation';
  END IF;

  IF p_org_name IS NULL OR TRIM(p_org_name) = '' THEN
    RAISE EXCEPTION 'Organisation name is required';
  END IF;

  v_slug := LOWER(REGEXP_REPLACE(TRIM(p_org_name), '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := TRIM(BOTH '-' FROM v_slug);
  v_slug := v_slug || '-' || SUBSTR(gen_random_uuid()::text, 1, 8);

  v_full_name := NULLIF(TRIM(COALESCE(p_first_name, '') || ' ' || COALESCE(p_last_name, '')), '');

  INSERT INTO organisations (name, slug, denomination, church_size, logo_url, country, city, address, post_code)
  VALUES (TRIM(p_org_name), v_slug, p_denomination, p_church_size, p_logo_url, p_country, p_city, p_address, p_post_code)
  RETURNING id INTO v_org_id;

  SELECT id INTO v_branch_id
  FROM branches
  WHERE org_id = v_org_id AND is_main_branch = TRUE
  LIMIT 1;

  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = v_user_id) INTO v_profile_exists;

  IF v_profile_exists THEN
    UPDATE profiles
    SET full_name    = COALESCE(v_full_name, full_name),
        phone        = COALESCE(p_phone, phone),
        church_role  = COALESCE(p_church_role, church_role),
        password_set = TRUE,
        org_id       = v_org_id,
        branch_id    = v_branch_id
    WHERE id = v_user_id;
  ELSE
    SELECT
      COALESCE(v_full_name, raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', email),
      email
    INTO v_full_name, v_email
    FROM auth.users
    WHERE id = v_user_id;

    INSERT INTO profiles (id, full_name, email, phone, church_role, org_id, branch_id, password_set)
    VALUES (v_user_id, v_full_name, v_email, p_phone, p_church_role, v_org_id, v_branch_id, TRUE);
  END IF;

  INSERT INTO user_roles (user_id, org_id, branch_id, role, is_active)
  VALUES (v_user_id, v_org_id, v_branch_id, 'super_admin', TRUE);

  RETURN v_org_id;
END;
$$;
