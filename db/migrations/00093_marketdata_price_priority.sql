-- +goose Up
-- A222 MQ1, MQ3: manual 1, csv 2, an official source 3, accrual 4, an unofficial source 5.
ALTER TABLE marketdata_price DROP CONSTRAINT marketdata_price_check1;

UPDATE marketdata_price SET priority = 4 WHERE source = 'accrual';

ALTER TABLE marketdata_price ADD CONSTRAINT marketdata_price_priority_check CHECK (
    priority BETWEEN 1 AND 5
    AND (source = 'manual') = (priority = 1)
    AND (source = 'csv') = (priority = 2)
);

-- +goose Down
ALTER TABLE marketdata_price DROP CONSTRAINT marketdata_price_priority_check;

UPDATE marketdata_price SET priority = 3 WHERE source NOT IN ('manual', 'csv');

ALTER TABLE marketdata_price ADD CONSTRAINT marketdata_price_check1
    CHECK (priority = CASE source WHEN 'manual' THEN 1 WHEN 'csv' THEN 2 ELSE 3 END);
