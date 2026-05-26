-- ============================================================
-- MINOX TRACKER — Sistema de Amigos
-- Execute no SQL Editor do Supabase (após o supabase_setup.sql)
-- ============================================================

-- 1. Tabela de perfis (criada automaticamente ao cadastrar)
CREATE TABLE public.profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        TEXT,
  display_name TEXT,
  invite_code  TEXT UNIQUE DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 8),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela de amizades
CREATE TABLE public.friendships (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'accepted'
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_friendship UNIQUE (requester_id, addressee_id),
  CONSTRAINT no_self_friendship CHECK (requester_id != addressee_id)
);

-- 3. Trigger: cria perfil automaticamente ao cadastrar usuário
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    split_part(NEW.email, '@', 1)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4. Populate profiles for existing users (roda uma vez)
INSERT INTO public.profiles (id, email, display_name)
SELECT
  id,
  email,
  split_part(email, '@', 1)
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- RLS — Profiles
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Qualquer autenticado pode ler perfis" ON public.profiles
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Usuário atualiza próprio perfil" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- ============================================================
-- RLS — Friendships
-- ============================================================
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver próprias amizades" ON public.friendships
  FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "Enviar pedido de amizade" ON public.friendships
  FOR INSERT WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Aceitar/rejeitar pedido" ON public.friendships
  FOR UPDATE USING (auth.uid() = addressee_id OR auth.uid() = requester_id);

CREATE POLICY "Remover amizade" ON public.friendships
  FOR DELETE USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- ============================================================
-- RLS — Atualiza política de registros para amigos verem
-- ============================================================

-- Remove a política de SELECT anterior
DROP POLICY IF EXISTS "Leitura própria" ON public.minoxidil_registros;

-- Nova política: próprios registros OU registros de amigos aceitos
CREATE POLICY "Leitura própria e amigos" ON public.minoxidil_registros
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.friendships
      WHERE status = 'accepted'
      AND (
        (requester_id = auth.uid() AND addressee_id = user_id)
        OR (addressee_id = auth.uid() AND requester_id = user_id)
      )
    )
  );

-- ============================================================
-- Índices
-- ============================================================
CREATE INDEX idx_friendships_requester ON public.friendships (requester_id, status);
CREATE INDEX idx_friendships_addressee ON public.friendships (addressee_id, status);
CREATE INDEX idx_profiles_invite_code  ON public.profiles (invite_code);
CREATE INDEX idx_profiles_email        ON public.profiles (email);
