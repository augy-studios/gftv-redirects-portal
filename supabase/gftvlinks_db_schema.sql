-- gftvlinks_api_keys table
create table public.gftvlinks_api_keys (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  api_key text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint gftvlinks_api_keys_pkey primary key (id),
  constraint gftvlinks_api_keys_api_key_key unique (api_key),
  constraint gftvlinks_api_keys_user_id_fkey foreign KEY (user_id) references gftvhello_users (id) on delete CASCADE
) TABLESPACE pg_default;

create unique INDEX IF not exists idx_api_keys_user_id on public.gftvlinks_api_keys using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_api_keys_api_key on public.gftvlinks_api_keys using btree (api_key) TABLESPACE pg_default;

-- gftvhello_backup_codes table
create table public.gftvhello_backup_codes (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  code_hash text not null,
  created_at timestamp with time zone not null default now(),
  constraint gftvhello_backup_codes_pkey primary key (id),
  constraint gftvhello_backup_codes_user_id_fkey foreign KEY (user_id) references gftvhello_users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_backup_codes_user on public.gftvhello_backup_codes using btree (user_id) TABLESPACE pg_default;

-- gftvlinks_linkhistory table
create table public.gftvlinks_linkhistory (
  id uuid not null default gen_random_uuid (),
  link_id uuid not null,
  event_type text not null,
  description text not null,
  created_at timestamp with time zone not null default now(),
  constraint gftvlinks_linkhistory_pkey primary key (id),
  constraint gftvlinks_linkhistory_link_id_fkey foreign KEY (link_id) references gftvlinks_links (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_linkhistory_link_id on public.gftvlinks_linkhistory using btree (link_id) TABLESPACE pg_default;

create index IF not exists idx_linkhistory_created_at on public.gftvlinks_linkhistory using btree (created_at desc) TABLESPACE pg_default;

-- gftvlinks_links table
create table public.gftvlinks_links (
  id uuid not null default gen_random_uuid (),
  slug text not null,
  destination text not null,
  user_id uuid null,
  is_active boolean null default true,
  access_count integer null default 0,
  tags text[] null default '{}'::text[],
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint gftvlinks_links_pkey primary key (id),
  constraint gftvlinks_links_slug_key unique (slug),
  constraint gftvlinks_links_user_id_fkey foreign KEY (user_id) references gftvhello_users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_links_slug on public.gftvlinks_links using btree (slug) TABLESPACE pg_default;

create index IF not exists idx_links_user_id on public.gftvlinks_links using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_links_tags on public.gftvlinks_links using gin (tags) TABLESPACE pg_default;

create trigger trg_link_history
after INSERT
or
update on gftvlinks_links for EACH row
execute FUNCTION fn_record_link_history ();

-- gftvlinks_linkvisits table
create table public.gftvlinks_linkvisits (
  id uuid not null default gen_random_uuid (),
  link_id uuid not null,
  slug text not null,
  visited_at timestamp with time zone not null default now(),
  device_type text not null default 'Others'::text,
  constraint gftvlinks_linkvisits_pkey primary key (id),
  constraint gftvlinks_linkvisits_link_id_fkey foreign KEY (link_id) references gftvlinks_links (id) on delete CASCADE,
  constraint chk_linkvisit_device_type check (
    (
      device_type = any (
        array[
          'Desktop'::text,
          'Tablet'::text,
          'Mobile'::text,
          'Others'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists gftvlinks_linkvisits_link_id_idx on public.gftvlinks_linkvisits using btree (link_id) TABLESPACE pg_default;

-- gftvlinks_ownership_requests table
create table public.gftvlinks_ownership_requests (
  id uuid not null default gen_random_uuid (),
  link_id uuid null,
  requester_id uuid null,
  owner_id uuid null,
  status text null default 'pending'::text,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint gftvlinks_ownership_requests_pkey primary key (id),
  constraint gftvlinks_ownership_requests_link_id_fkey foreign KEY (link_id) references gftvlinks_links (id) on delete CASCADE,
  constraint gftvlinks_ownership_requests_owner_id_fkey foreign KEY (owner_id) references gftvhello_users (id) on delete CASCADE,
  constraint gftvlinks_ownership_requests_requester_id_fkey foreign KEY (requester_id) references gftvhello_users (id) on delete CASCADE
) TABLESPACE pg_default;

-- gftvlinks_profileviews table
create table public.gftvlinks_profileviews (
  id uuid not null default gen_random_uuid (),
  viewer_id uuid not null,
  viewed_id uuid not null,
  viewed_at timestamp with time zone not null default now(),
  constraint gftvlinks_profileviews_pkey primary key (id),
  constraint gftvlinks_profileviews_viewer_id_viewed_id_key unique (viewer_id, viewed_id),
  constraint gftvlinks_profileviews_viewed_id_fkey foreign KEY (viewed_id) references gftvhello_users (id) on delete CASCADE,
  constraint gftvlinks_profileviews_viewer_id_fkey foreign KEY (viewer_id) references gftvhello_users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_profileviews_viewed_id on public.gftvlinks_profileviews using btree (viewed_id, viewed_at desc) TABLESPACE pg_default;

-- gftvhello_sessions table
create table public.gftvhello_sessions (
  id uuid not null default gen_random_uuid (),
  user_id uuid null,
  token text not null,
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone null default now(),
  constraint gftvhello_sessions_pkey primary key (id),
  constraint gftvhello_sessions_token_key unique (token),
  constraint gftvhello_sessions_user_id_fkey foreign KEY (user_id) references gftvhello_users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_sessions_token on public.gftvhello_sessions using btree (token) TABLESPACE pg_default;

create index IF not exists idx_sessions_user_id on public.gftvhello_sessions using btree (user_id) TABLESPACE pg_default;

-- gftvhello_totp_challenges table
create table public.gftvhello_totp_challenges (
  token text not null,
  user_id uuid not null,
  expires_at timestamp with time zone not null default (now() + '00:10:00'::interval),
  constraint gftvhello_totp_challenges_pkey primary key (token),
  constraint gftvhello_totp_challenges_user_id_fkey foreign KEY (user_id) references gftvhello_users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_totp_challenges_user on public.gftvhello_totp_challenges using btree (user_id) TABLESPACE pg_default;

-- gftvhello_trusted_devices table
create table public.gftvhello_trusted_devices (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  device_token text not null,
  expires_at timestamp with time zone not null default (now() + '30 days'::interval),
  constraint gftvhello_trusted_devices_pkey primary key (id),
  constraint gftvhello_trusted_devices_device_token_key unique (device_token),
  constraint gftvhello_trusted_devices_user_id_fkey foreign KEY (user_id) references gftvhello_users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_trusted_devices_token on public.gftvhello_trusted_devices using btree (device_token) TABLESPACE pg_default;

create index IF not exists idx_trusted_devices_user on public.gftvhello_trusted_devices using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_trusted_devices_user_id on public.gftvhello_trusted_devices using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_trusted_devices_device_token on public.gftvhello_trusted_devices using btree (device_token) TABLESPACE pg_default;

-- gftvhello_users table
create table public.gftvhello_users (
  id uuid not null default gen_random_uuid (),
  username text not null,
  display_name text not null,
  email text not null,
  password_hash text not null,
  is_admin boolean null default false,
  is_approved boolean null default false,
  avatar_url text null,
  social_links jsonb null default '[]'::jsonb,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  is_editor boolean not null default false,
  totp_secret text null,
  constraint gftvhello_users_pkey primary key (id),
  constraint gftvhello_users_email_key unique (email),
  constraint gftvhello_users_username_key unique (username)
) TABLESPACE pg_default;

-- gftvlinks_users_preapproved table
create table public.gftvlinks_users_preapproved (
  id uuid not null default gen_random_uuid (),
  email text not null,
  preapproved_role text not null,
  user_id uuid null,
  preapproved_by uuid null,
  preapproved_at timestamp with time zone not null default now(),
  activated_at timestamp with time zone null,
  constraint gftvlinks_users_preapproved_pkey primary key (id),
  constraint gftvlinks_users_preapproved_email_key unique (email),
  constraint gftvlinks_users_preapproved_preapproved_by_fkey foreign KEY (preapproved_by) references gftvhello_users (id) on delete set null,
  constraint gftvlinks_users_preapproved_user_id_fkey foreign KEY (user_id) references gftvhello_users (id) on delete set null,
  constraint gftvlinks_users_preapproved_preapproved_role_check check (
    (
      preapproved_role = any (array['viewer'::text, 'editor'::text])
    )
  )
) TABLESPACE pg_default;
