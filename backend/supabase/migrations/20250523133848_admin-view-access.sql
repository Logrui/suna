DROP POLICY IF EXISTS "Give read only access to internal users" ON threads;

CREATE POLICY "Give read only access to internal users" ON threads
FOR SELECT
USING (
    ((current_setting('request.jwt.claims', true)::json ->> 'email') ~~ '%@kortix.ai'::text)
);


DROP POLICY IF EXISTS "Give read only access to internal users" ON messages;

CREATE POLICY "Give read only access to internal users" ON messages
FOR SELECT
USING (
    ((current_setting('request.jwt.claims', true)::json ->> 'email') ~~ '%@kortix.ai'::text)
);


DROP POLICY IF EXISTS "Give read only access to internal users" ON projects;

CREATE POLICY "Give read only access to internal users" ON projects
FOR SELECT
USING (
    ((current_setting('request.jwt.claims', true)::json ->> 'email') ~~ '%@kortix.ai'::text)
);
