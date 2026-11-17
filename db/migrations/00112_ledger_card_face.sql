-- +goose Up
-- Card faces spec 4.9: the appearance of a credit card account and the network of a plastic card.
ALTER TABLE ledger_account
    ADD COLUMN face_color text CONSTRAINT ledger_account_face_color_check CHECK (face_color ~ '^#[0-9a-f]{6}$'),
    ADD COLUMN face_art text CONSTRAINT ledger_account_face_art_check CHECK (face_art ~ '^[a-z0-9_]{2,40}$'),
    ADD COLUMN face_chip text CONSTRAINT ledger_account_face_chip_check CHECK (face_chip IN ('gold', 'silver')),
    ADD COLUMN face_orientation text CONSTRAINT ledger_account_face_orientation_check CHECK (face_orientation IN ('horizontal', 'vertical')),
    ADD COLUMN face_brand text CONSTRAINT ledger_account_face_brand_check CHECK (face_brand IN ('auto', 'plate', 'name', 'none'));

ALTER TABLE ledger_card
    ADD COLUMN network text CONSTRAINT ledger_card_network_check CHECK (network ~ '^[a-z0-9_]{2,40}$');

-- +goose Down
ALTER TABLE ledger_card DROP COLUMN network;

ALTER TABLE ledger_account
    DROP COLUMN face_brand,
    DROP COLUMN face_orientation,
    DROP COLUMN face_chip,
    DROP COLUMN face_art,
    DROP COLUMN face_color;
