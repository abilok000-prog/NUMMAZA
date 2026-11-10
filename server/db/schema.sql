-- NUMMAZA: схема базы данных (PostgreSQL 13+). Выполняется при каждом старте, поэтому всё через IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  login         text NOT NULL UNIQUE,          -- +77001234567 или email в нижнем регистре
  name          text NOT NULL,
  pass_hash     text NOT NULL,                 -- scrypt$N$r$p$соль$хеш
  created_at    timestamptz NOT NULL DEFAULT now(),
  failed_logins integer NOT NULL DEFAULT 0,
  locked_until  timestamptz
);

-- Сессия = пара токенов. В базе только SHA-256 токенов, сами токены знает лишь устройство.
CREATE TABLE IF NOT EXISTS sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_hash     text NOT NULL UNIQUE,
  access_expires  timestamptz NOT NULL,
  refresh_hash    text NOT NULL UNIQUE,
  refresh_expires timestamptz NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  revoked_at      timestamptz,
  user_agent      text
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

-- Синхронизируемые записи пользователя: операции, цели, выписки, конверты, правила, профиль.
-- seq растёт при каждом изменении — по нему устройство забирает «всё новое после курсора».
CREATE SEQUENCE IF NOT EXISTS records_seq;
CREATE TABLE IF NOT EXISTS records (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       text NOT NULL,
  rec_id     text NOT NULL,
  data       jsonb,
  updated_at bigint NOT NULL,                  -- время изменения на устройстве, мс (правило «последняя запись побеждает»)
  deleted    boolean NOT NULL DEFAULT false,
  seq        bigint NOT NULL DEFAULT nextval('records_seq'),
  PRIMARY KEY (user_id, kind, rec_id)
);
CREATE INDEX IF NOT EXISTS records_user_seq_idx ON records(user_id, seq);

-- 1.3: почта для восстановления пароля
ALTER TABLE users ADD COLUMN IF NOT EXISTS email text;

-- Коды сброса пароля: в базе только хеш кода, 15 минут, не больше 5 попыток
CREATE TABLE IF NOT EXISTS password_resets (
  user_id    uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  code_hash  text NOT NULL,
  expires    timestamptz NOT NULL,
  attempts   integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Push-уведомления на сайте (iPhone «На экран Домой», браузеры): подписки и запланированные напоминания
CREATE TABLE IF NOT EXISTS push_subs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint   text NOT NULL UNIQUE,
  p256dh     text NOT NULL,
  auth       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS push_items (
  sub_id  uuid NOT NULL REFERENCES push_subs(id) ON DELETE CASCADE,
  item_id text NOT NULL,
  at      timestamptz NOT NULL,
  title   text NOT NULL,
  body    text NOT NULL,
  sent_at timestamptz,
  PRIMARY KEY (sub_id, item_id)
);
CREATE INDEX IF NOT EXISTS push_items_due_idx ON push_items(at) WHERE sent_at IS NULL;

-- Семейный бюджет: семья, участники (не больше одной семьи на человека), приглашения, общие траты
CREATE TABLE IF NOT EXISTS families (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  owner       uuid REFERENCES users(id) ON DELETE SET NULL,
  month_limit bigint NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS family_members (
  user_id   uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS family_invites (
  code      text PRIMARY KEY,
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  expires   timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS family_records (
  family_id  uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rec_id     text NOT NULL,
  date       text NOT NULL,
  data       jsonb NOT NULL,
  PRIMARY KEY (family_id, user_id, rec_id)
);
