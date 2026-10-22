BEGIN;
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "a51886f0-7fd2-411c-8d96-1bab2bdfcb2d", "role": "authenticated", "aal": "aal1"}';
SELECT public.has_permission('employee.directory.read') as has_perm_aal1;

SET LOCAL "request.jwt.claims" = '{"sub": "a51886f0-7fd2-411c-8d96-1bab2bdfcb2d", "role": "authenticated", "aal": "aal2"}';
SELECT public.has_permission('employee.directory.read') as has_perm_aal2;
SELECT count(*) FROM public.list_employees();
ROLLBACK;
