-- +goose Up
-- Appearance studio spec A19: a member whose stored theme is the previous default takes the new
-- one. The web writes every default on first use, so the previous one is stored, not absent.
UPDATE identity_member
SET appearance = appearance
    || '{"accent": "cyan", "tone": "slate", "success": "#14b8a6", "danger": "#f97066",
         "corners": "round", "typeface": "grotesque", "depth": "soft", "step": "wide"}'::jsonb
    || CASE
        WHEN appearance ->> 'density' = 'comfortable' THEN '{"density": "compact"}'::jsonb
        ELSE '{}'::jsonb
    END
WHERE appearance @> '{"accent": "indigo", "tone": "graphite", "success": "theme",
                      "danger": "theme", "warning": "theme", "info": "theme",
                      "corners": "standard", "typeface": "geist", "depth": "standard",
                      "step": "standard", "borders": "subtle", "shadows": "soft",
                      "chart": "spectrum"}'::jsonb
    AND coalesce(appearance ->> 'visual', 'standard') = 'standard';

-- +goose Down
-- The previous values are not kept: a member returns to them in the appearance studio.
SELECT 1;
