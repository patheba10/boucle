-- Tests de la base des comptes (pgTAP). En CI : supabase db start puis supabase test db.
-- On joue chaque rôle comme le ferait l'API : « anon » pour un visiteur, « authenticated » avec l'identifiant
-- de l'utilisateur dans les claims du JWT.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- Deux utilisateurs : Ada par GitHub (nom et avatar fournis), Linus par e-mail.
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'ada@exemple.org', '{"full_name": "Ada Lovelace", "avatar_url": "https://avatars.githubusercontent.com/u/1"}'),
  ('22222222-2222-2222-2222-222222222222', 'linus@exemple.org', '{"avatar_url": "javascript:alert(1)"}');

-- Structure
select has_table('public', 'profils', 'table profils');
select has_table('public', 'progressions', 'table progressions');
select is((select relrowsecurity from pg_class where oid = 'public.profils'::regclass), true, 'RLS active sur profils');
select is((select relrowsecurity from pg_class where oid = 'public.progressions'::regclass), true, 'RLS active sur progressions');

-- Création automatique à l'inscription
select is((select nom from public.profils where id = '11111111-1111-1111-1111-111111111111'), 'Ada Lovelace', 'nom repris du fournisseur');
select is((select nom from public.profils where id = '22222222-2222-2222-2222-222222222222'), 'linus', 'sans nom : début de l''adresse e-mail');
select is((select avatar_url from public.profils where id = '22222222-2222-2222-2222-222222222222'), null, 'avatar non https écarté');
select is((select revision from public.progressions where user_id = '11111111-1111-1111-1111-111111111111'), 1::bigint, 'progression vide créée');

-- Visiteur anonyme : aucun accès
set local role anon;
select throws_ok('select * from public.profils', '42501', null, 'anon ne lit pas les profils');
select throws_ok('select * from public.progressions', '42501', null, 'anon ne lit pas les progressions');
select throws_ok($$select public.enregistrer_progression('{}', 1)$$, '42501', null, 'anon n''écrit pas de progression');
reset role;

-- Ada connectée
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select is((select count(*) from public.profils), 1::bigint, 'Ada ne voit que son profil');
select is((select count(*) from public.progressions), 1::bigint, 'Ada ne voit que sa progression');
select is((select count(*) from public.profils where id = '22222222-2222-2222-2222-222222222222'), 0::bigint, 'le profil de Linus est invisible');
update public.profils set nom = 'pirate' where id = '22222222-2222-2222-2222-222222222222';
update public.profils set nom = 'Ada', objectif = 'ml' where id = '11111111-1111-1111-1111-111111111111';
select throws_ok($$update public.profils set id = '22222222-2222-2222-2222-222222222222'$$, '42501', null, 'l''identifiant n''est pas modifiable');
select throws_ok($$update public.profils set avatar_url = 'http://non-securise.org/a.png'$$, '23514', null, 'avatar en http refusé');
select throws_ok($$delete from public.profils$$, '42501', null, 'pas de suppression directe du profil');
select throws_ok($$insert into public.progressions (user_id) values ('22222222-2222-2222-2222-222222222222')$$, '42501', null, 'pas d''écriture directe de progression');
select is(public.enregistrer_progression('{"xp": 40}', 1), 2::bigint, 'écriture avec la bonne révision');
select throws_ok($$select public.enregistrer_progression('{"xp": 10}', 1)$$, '40001', null, 'révision périmée : conflit');
select throws_ok($$select public.enregistrer_progression('[1, 2]', 2)$$, '23514', null, 'la progression doit être un objet');
reset role;

select is((select nom from public.profils where id = '22222222-2222-2222-2222-222222222222'), 'linus', 'Ada n''a pas pu renommer Linus');
select is((select donnees ->> 'xp' from public.progressions where user_id = '11111111-1111-1111-1111-111111111111'), '40', 'progression d''Ada enregistrée');

-- Suppression du compte : tout part en cascade
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.supprimer_mon_compte();
reset role;
select is((select count(*) from public.progressions where user_id = '11111111-1111-1111-1111-111111111111')
        + (select count(*) from public.profils where id = '11111111-1111-1111-1111-111111111111')
        + (select count(*) from auth.users where id = '11111111-1111-1111-1111-111111111111'), 0::bigint, 'compte supprimé avec ses données');

select * from finish();
rollback;
