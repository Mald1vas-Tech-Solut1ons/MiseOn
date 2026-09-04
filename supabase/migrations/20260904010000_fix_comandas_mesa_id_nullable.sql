-- Migration: Permitir comandas individuais de cartão/balança sem exigir mesa_id
-- Data: 2026-09-04

ALTER TABLE public.comandas ALTER COLUMN mesa_id DROP NOT NULL;
