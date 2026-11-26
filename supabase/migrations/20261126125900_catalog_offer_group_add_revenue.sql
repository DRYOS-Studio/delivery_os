-- catalog: novo valor do enum — transação separada (PG não permite usar o label novo na mesma TX).

ALTER TYPE public.catalog_offer_group ADD VALUE IF NOT EXISTS 'revenue';