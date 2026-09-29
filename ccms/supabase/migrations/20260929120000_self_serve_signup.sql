-- Self-serve signup: RPC to bootstrap a new organisation for a freshly
-- registered user (Google OAuth or email/password sign-up).

CREATE OR REPLACE FUNCTION public.setup_new_organisation(p_org_name TEXT)
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
  -- Get calling user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Guard: user must not already have any roles (prevents double-org creation)
  IF EXISTS (SELECT 1 FROM user_roles WHERE user_id = v_user_id) THEN
    RAISE EXCEPTION 'User already belongs to an organisation';
  END IF;

  -- Validate org name
  IF p_org_name IS NULL OR TRIM(p_org_name) = '' THEN
    RAISE EXCEPTION 'Organisation name is required';
  END IF;

  -- Generate a URL-safe slug from the org name, append random suffix for uniqueness
  v_slug := LOWER(REGEXP_REPLACE(TRIM(p_org_name), '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := TRIM(BOTH '-' FROM v_slug);
  v_slug := v_slug || '-' || SUBSTR(gen_random_uuid()::text, 1, 8);

  -- Create organisation
  INSERT INTO organisations (name, slug)
  VALUES (TRIM(p_org_name), v_slug)
  RETURNING id INTO v_org_id;

  -- The trg_create_main_branch trigger auto-creates a Main Branch.
  -- Fetch its id so we can assign the user to it.
  SELECT id INTO v_branch_id
  FROM branches
  WHERE org_id = v_org_id AND is_main_branch = TRUE
  LIMIT 1;

  -- Ensure profile exists
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = v_user_id) INTO v_profile_exists;

  IF v_profile_exists THEN
    UPDATE profiles
    SET password_set = TRUE,
        org_id      = v_org_id,
        branch_id   = v_branch_id
    WHERE id = v_user_id;
  ELSE
    -- Pull metadata from auth.users for first-time Google/email signups
    SELECT
      COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', email),
      email
    INTO v_full_name, v_email
    FROM auth.users
    WHERE id = v_user_id;

    INSERT INTO profiles (id, full_name, email, org_id, branch_id, password_set)
    VALUES (v_user_id, v_full_name, v_email, v_org_id, v_branch_id, TRUE);
  END IF;

  -- Assign super_admin role
  INSERT INTO user_roles (user_id, org_id, branch_id, role, is_active)
  VALUES (v_user_id, v_org_id, v_branch_id, 'super_admin', TRUE);

  RETURN v_org_id;
END;
$$;
