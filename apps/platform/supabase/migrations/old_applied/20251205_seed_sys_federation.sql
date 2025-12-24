-- Ensure sys:federation tag exists
INSERT INTO public.tags (name, description, category)
SELECT 'sys:federation', 'Delegation of the right to federate content (Ascending Subsidiarity)', 'system'
WHERE NOT EXISTS (
    SELECT 1 FROM public.tags WHERE name = 'sys:federation'
);
