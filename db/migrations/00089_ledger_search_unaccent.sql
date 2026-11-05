-- +goose Up
-- The transaction search compares text without accents (unaccent ships with btree_gist in contrib).
CREATE EXTENSION IF NOT EXISTS unaccent;

-- +goose Down
DROP EXTENSION IF EXISTS unaccent;
