-- Comptes Boucle : profil et progression de chaque utilisateur.
-- Sécurité : Row Level Security sur chaque table ; un utilisateur connecté ne lit et n'écrit que ses propres
-- lignes, un visiteur anonyme n'a accès à rien. Testé par supabase/tests/comptes.test.sql (pgTAP, en CI).

-- ---------------------------------------------------------------- profils
create table public.profils (
  id uuid primary key references auth.users (id) on delete cascade,
  nom text check (char_length(nom) between 1 and 60),
  avatar_url text check (avatar_url ~ '^https://[^\s"<>]+$' and char_length(avatar_url) <= 500),
  objectif text check (objectif in ('devops', 'cloud', 'ml', 'iot')),
  roadmap text check (char_length(roadmap) <= 40),
  cree_le timestamptz not null default now(),
  maj_le timestamptz not null default now()
);

comment on table public.profils is 'Profil affiché dans l''espace personnel : nom, avatar, objectif, roadmap suivie.';

-- ---------------------------------------------------------------- progressions
-- La progression est le même objet que celui du navigateur (format « boucle-progression » de lib/sauvegarde.js),
-- rangé tel quel. « revision » augmente à chaque écriture : un appareil qui écrit avec une révision périmée est
-- refusé, relit, fusionne et réessaie (concurrence optimiste, voir enregistrer_progression).
create table public.progressions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  donnees jsonb not null default '{}'::jsonb check (jsonb_typeof(donnees) = 'object' and pg_column_size(donnees) < 1500000),
  revision bigint not null default 1 check (revision >= 1),
  maj_le timestamptz not null default now()
);

comment on table public.progressions is 'Progression synchronisée (XP, leçons, défis, code, révisions) d''un utilisateur.';

-- ---------------------------------------------------------------- droits
alter table public.profils enable row level security;
alter table public.progressions enable row level security;

-- Supabase accorde par défaut les tables de « public » aux rôles anon et authenticated : on retire tout,
-- puis on rend seulement ce qui est utile. La suppression passe par supprimer_mon_compte() (cascade).
revoke all on public.profils, public.progressions from anon, authenticated;
grant select, update (nom, avatar_url, objectif, roadmap) on public.profils to authenticated;
grant select on public.progressions to authenticated;

create policy "profil : lire le sien" on public.profils
  for select to authenticated using (id = (select auth.uid()));
create policy "profil : modifier le sien" on public.profils
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "progression : lire la sienne" on public.progressions
  for select to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------- horodatage
create function public.toucher_maj_le() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.maj_le := now();
  return new;
end;
$$;

create trigger profils_maj_le before update on public.profils
  for each row execute function public.toucher_maj_le();

-- ---------------------------------------------------------------- création du profil à l'inscription
-- GitHub et Google fournissent un nom et un avatar ; une inscription par e-mail n'a que l'adresse.
create function public.creer_profil() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  nom text := left(nullif(trim(coalesce(meta ->> 'full_name', meta ->> 'name', meta ->> 'user_name', split_part(new.email, '@', 1))), ''), 60);
  avatar text := meta ->> 'avatar_url';
begin
  if avatar is not null and (avatar !~ '^https://[^\s"<>]+$' or char_length(avatar) > 500) then
    avatar := null;
  end if;
  insert into public.profils (id, nom, avatar_url) values (new.id, nom, avatar);
  insert into public.progressions (user_id) values (new.id);
  return new;
end;
$$;

create trigger creer_profil_apres_inscription after insert on auth.users
  for each row execute function public.creer_profil();

-- ---------------------------------------------------------------- écriture de la progression
-- Écrit la progression si « revision_attendue » est la révision actuelle, et renvoie la nouvelle révision.
-- Sinon (un autre appareil a écrit entre-temps), erreur 40001 : le client relit, fusionne et réessaie.
create function public.enregistrer_progression(donnees jsonb, revision_attendue bigint) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  moi uuid := auth.uid();
  nouvelle bigint;
begin
  if moi is null then
    raise exception 'connexion requise' using errcode = '42501';
  end if;
  update public.progressions p
     set donnees = enregistrer_progression.donnees, revision = p.revision + 1, maj_le = now()
   where p.user_id = moi and p.revision = revision_attendue
  returning p.revision into nouvelle;
  if nouvelle is null then
    -- Pas encore de ligne (compte créé avant cette table) : la première écriture la crée.
    if revision_attendue = 0 and not exists (select 1 from public.progressions where user_id = moi) then
      insert into public.progressions (user_id, donnees) values (moi, enregistrer_progression.donnees)
      returning revision into nouvelle;
      return nouvelle;
    end if;
    raise exception 'progression modifiée sur un autre appareil' using errcode = '40001';
  end if;
  return nouvelle;
end;
$$;

-- ---------------------------------------------------------------- suppression du compte (Loi 25, RGPD)
-- Efface l'utilisateur ; profil et progression suivent par cascade.
create function public.supprimer_mon_compte() returns void
language plpgsql security definer set search_path = '' as $$
declare
  moi uuid := auth.uid();
begin
  if moi is null then
    raise exception 'connexion requise' using errcode = '42501';
  end if;
  delete from auth.users where id = moi;
end;
$$;

revoke all on function public.enregistrer_progression(jsonb, bigint), public.supprimer_mon_compte(),
  public.creer_profil(), public.toucher_maj_le() from public, anon, authenticated;
grant execute on function public.enregistrer_progression(jsonb, bigint), public.supprimer_mon_compte() to authenticated;
