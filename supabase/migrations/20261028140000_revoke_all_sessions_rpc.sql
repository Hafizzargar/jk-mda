-- Function to securely revoke all sessions and refresh tokens across all devices for a given user
CREATE OR REPLACE FUNCTION public.revoke_all_user_sessions(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  deleted_sessions_count INT := 0;
  deleted_tokens_count INT := 0;
BEGIN
  -- Delete all refresh tokens for this user
  DELETE FROM auth.refresh_tokens
  WHERE user_id = target_user_id::text
     OR session_id IN (SELECT id FROM auth.sessions WHERE user_id = target_user_id);
  GET DIAGNOSTICS deleted_tokens_count = ROW_COUNT;

  -- Delete all active sessions for this user
  DELETE FROM auth.sessions
  WHERE user_id = target_user_id;
  GET DIAGNOSTICS deleted_sessions_count = ROW_COUNT;

  -- Update profiles updated_at
  UPDATE public.profiles
  SET updated_at = NOW()
  WHERE id = target_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', target_user_id,
    'sessions_revoked', deleted_sessions_count,
    'tokens_revoked', deleted_tokens_count,
    'revoked_at', NOW()
  );
END;
$$;

-- Secure the RPC function: Only service_role can call this function directly
REVOKE ALL ON FUNCTION public.revoke_all_user_sessions(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_all_user_sessions(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_all_user_sessions(UUID) TO postgres;
