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

-- A82: classification references follow a payee merge. A payee match key is "payee:<id>".

-- name: MergePayeeAliases :exec
UPDATE classification_payee_alias SET payee_id = @into_id::uuid
WHERE user_id = @user_id AND payee_id = @from_id::uuid;

-- name: DeletePayeeMergeCollidingSuggestions :exec
DELETE FROM classification_suggestion d
WHERE d.user_id = @user_id AND d.id IN (
    SELECT greatest(s.id, o.id)
    FROM classification_suggestion s
    JOIN classification_suggestion o
      ON o.user_id = s.user_id AND o.fingerprint = replace(s.fingerprint, @from_id::text, @into_id::text)
    WHERE s.user_id = @user_id AND s.fingerprint LIKE 'payee:' || @from_id::text || ' -> %'
);

-- name: MergePayeeSuggestions :exec
UPDATE classification_suggestion
SET fingerprint = replace(fingerprint, @from_id::text, @into_id::text),
    conditions = replace(conditions::text, @from_id::text, @into_id::text)::jsonb
WHERE user_id = @user_id AND fingerprint LIKE 'payee:' || @from_id::text || ' -> %';

-- name: MergePayeeRules :exec
UPDATE classification_rule
SET conditions = replace(conditions::text, @from_id::text, @into_id::text)::jsonb,
    actions = replace(actions::text, @from_id::text, @into_id::text)::jsonb, updated_at = now()
WHERE user_id = @user_id AND (strpos(conditions::text, @from_id::text) > 0 OR strpos(actions::text, @from_id::text) > 0);

-- name: MergePayeeMatchKeys :exec
UPDATE classification_categorization SET match_key = 'payee:' || @into_id::text
WHERE user_id = @user_id AND match_key = 'payee:' || @from_id::text;

-- name: RenameRuleTag :exec
-- A rule that adds a renamed or merged tag adds the tag's new name, once.
UPDATE classification_rule r
SET actions = (
        SELECT jsonb_agg(CASE WHEN x.a ? 'tags' THEN jsonb_set(x.a, '{tags}', (
            SELECT jsonb_agg(DISTINCT CASE WHEN t = @from_name::text THEN @into_name::text ELSE t END)
            FROM jsonb_array_elements_text(x.a -> 'tags') t)) ELSE x.a END ORDER BY x.i)
        FROM jsonb_array_elements(r.actions) WITH ORDINALITY AS x (a, i)),
    updated_at = now()
WHERE r.user_id = @user_id
  AND jsonb_path_exists(r.actions, '$[*].tags[*] ? (@ == $t)', jsonb_build_object('t', @from_name::text));
