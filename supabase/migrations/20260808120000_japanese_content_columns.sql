-- Japanese content columns. Nullable by design: clients fall back to the
-- English variant wherever a _ja value is missing.
ALTER TABLE places ADD COLUMN IF NOT EXISTS name_ja text, ADD COLUMN IF NOT EXISTS desc_ja text, ADD COLUMN IF NOT EXISTS neighborhood_ja text;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS title_ja text, ADD COLUMN IF NOT EXISTS desc_ja text;
ALTER TABLE cities ADD COLUMN IF NOT EXISTS name_ja text, ADD COLUMN IF NOT EXISTS short_ja text;
