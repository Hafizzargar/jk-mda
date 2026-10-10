-- Create a table to track newsletter subscription requests per IP
CREATE TABLE IF NOT EXISTS public.newsletter_ip_rate_limit (
    ip_address text PRIMARY KEY,
    request_count integer NOT NULL DEFAULT 1,
    last_request_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Secure the table
ALTER TABLE public.newsletter_ip_rate_limit ENABLE ROW LEVEL SECURITY;
-- No public policies; only service_role should access this table

-- Create an RPC to atomically check and increment the rate limit
CREATE OR REPLACE FUNCTION public.check_newsletter_rate_limit(p_ip_address text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count integer;
BEGIN
    -- Clean up expired rate limits (older than 1 hour)
    DELETE FROM public.newsletter_ip_rate_limit 
    WHERE last_request_at < now() - interval '1 hour';

    -- Upsert the IP address
    INSERT INTO public.newsletter_ip_rate_limit (ip_address, request_count, last_request_at)
    VALUES (p_ip_address, 1, now())
    ON CONFLICT (ip_address) 
    DO UPDATE SET 
        request_count = public.newsletter_ip_rate_limit.request_count + 1,
        last_request_at = now()
    RETURNING request_count INTO v_count;

    -- Return true if under or at the limit of 3 requests per hour
    RETURN v_count <= 3;
END;
$$;

-- Revoke public execution
REVOKE EXECUTE ON FUNCTION public.check_newsletter_rate_limit(text) FROM public;
REVOKE EXECUTE ON FUNCTION public.check_newsletter_rate_limit(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_newsletter_rate_limit(text) TO service_role;
