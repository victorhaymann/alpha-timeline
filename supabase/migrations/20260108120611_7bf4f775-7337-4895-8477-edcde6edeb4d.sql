-- Expose ONLY hidden meeting dates to public shared-link viewers via a secure RPC
-- (keeps full meeting_notes protected by RLS)

CREATE OR REPLACE FUNCTION public.get_shared_hidden_meeting_dates(_token text)
RETURNS TABLE(meeting_date date)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate share token
  IF _token IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.project_shares ps
    WHERE ps.token = _token
      AND ps.is_active = true
  ) THEN
    RETURN;
  END IF;

  -- Bypass RLS inside this SECURITY DEFINER function
  PERFORM set_config('row_security', 'off', true);

  RETURN QUERY
  SELECT mn.meeting_date
  FROM public.meeting_notes mn
  JOIN public.project_shares ps ON ps.project_id = mn.project_id
  WHERE ps.token = _token
    AND ps.is_active = true
    AND COALESCE(mn.client_hidden, false) = true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_shared_hidden_meeting_dates(text) TO anon, authenticated;