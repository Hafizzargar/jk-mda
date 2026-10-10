DO $$
BEGIN
    -- Safely rename the column if it hasn't been renamed yet
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'newsletter_ip_rate_limit'
          AND column_name = 'last_request_at'
    ) THEN
        ALTER TABLE public.newsletter_ip_rate_limit RENAME COLUMN last_request_at TO window_start_at;
    END IF;
END $$;

-- Update the RPC to use window_start_at and not extend the window on every request
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
    WHERE window_start_at < now() - interval '1 hour';

    -- Upsert the IP address
    INSERT INTO public.newsletter_ip_rate_limit (ip_address, request_count, window_start_at)
    VALUES (p_ip_address, 1, now())
    ON CONFLICT (ip_address) 
    DO UPDATE SET 
        request_count = public.newsletter_ip_rate_limit.request_count + 1
    RETURNING request_count INTO v_count;

    -- Return true if under or at the limit of 3 requests per hour
    RETURN v_count <= 3;
END;
$$;
