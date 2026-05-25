-- ============================================================
-- MINOX TRACKER — Script de Setup do Supabase
-- Execute no SQL Editor do painel do Supabase
-- ============================================================

-- Extensão UUID (geralmente já ativada no Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabela principal de registros de aplicação
CREATE TABLE public.minoxidil_registros (
  id            UUID        DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data_registro DATE        NOT NULL,
  aplicado      BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW(),

  -- Garante apenas 1 registro por usuário por dia
  CONSTRAINT unique_user_date UNIQUE (user_id, data_registro)
);

-- ============================================================
-- Row Level Security (RLS) — cada usuário vê apenas seus dados
-- ============================================================
ALTER TABLE public.minoxidil_registros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura própria" ON public.minoxidil_registros
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Inserção própria" ON public.minoxidil_registros
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Atualização própria" ON public.minoxidil_registros
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Exclusão própria" ON public.minoxidil_registros
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- Índice para buscas por usuário (melhora performance)
-- ============================================================
CREATE INDEX idx_registros_user_date
  ON public.minoxidil_registros (user_id, data_registro DESC);
