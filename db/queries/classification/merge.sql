-- A75: classification references follow a category merge. A suggestion fingerprint ends in
-- " -> <category id>" (domain.Fingerprint).

-- name: DeleteMergeCollidingSuggestions :exec
-- Of two suggestions whose fingerprints become equal, the newer goes (one per fingerprint, A24).
DELETE FROM classification_suggestion d
WHERE d.user_id = @user_id AND d.id IN (
    SELECT greatest(s.id, o.id)
    FROM classification_suggestion s
    JOIN classification_suggestion o
      ON o.user_id = s.user_id AND o.fingerprint = replace(s.fingerprint, @from_id::text, @into_id::text)
    WHERE s.user_id = @user_id AND s.fingerprint LIKE '% -> ' || @from_id::text
);

-- name: MergeSuggestions :exec
UPDATE classification_suggestion
SET fingerprint = replace(fingerprint, @from_id::text, @into_id::text),
    actions = replace(actions::text, @from_id::text, @into_id::text)::jsonb
WHERE user_id = @user_id AND fingerprint LIKE '% -> ' || @from_id::text;

-- name: MergeRuleActions :exec
UPDATE classification_rule
SET actions = replace(actions::text, @from_id::text, @into_id::text)::jsonb, updated_at = now()
WHERE user_id = @user_id AND strpos(actions::text, @from_id::text) > 0;

-- name: MergeSourceCategories :exec
UPDATE classification_source_category SET category_id = @into_id
WHERE user_id = @user_id AND category_id = @from_id;

-- name: MergeCategorizations :exec
UPDATE classification_categorization SET category_id = @into_id
WHERE user_id = @user_id AND category_id = @from_id;
