-- ============================================================
-- TERANGA LABS — Migration 0033 : offre de bienvenue
--
-- Objectif : supprimer la friction du tout premier échange.
--   - Client      : son 1er brief est offert.
--   - Développeur : son 1er contact déblocé est offert.
--
-- L'offre est strictement UNE FOIS PAR COMPTE. Le contrôle est fait
-- dans la même transaction que le débit (security definer), donc
-- deux appels concurrents ne peuvent pas s'octroyer deux fois le
-- cadeau : le verrou est posé sur la ligne du demandeur.
--
-- Anti-abus, sans infrastructure supplémentaire :
--   1. L'offre est liée à l'ID Supabase Auth (auth.uid()). Créer un
--      nouveau compte = nouvelle offre, donc la parade reste la
--      modération des comptes et la vérification d'identité.
--   2. L'écriture des tables reste interdite : un attaquant ne peut
--      PAS s'octroyer des Tokens en écrivant dans token_transactions,
--      il doit passer par publish_brief / unlock_and_start_chat.
-- 3. Chaque gratis est tracé dans le journal token_transactions
--      avec amount = 0 (rien à débiter) et un motif identifiable
--      via gift_key, pour que l'équipe puisse auditer le coût réel
--      de l'acquisition.
--
-- Coût pour le business : un Token (2 500 FCFA) par nouveau compte
-- qui va jusqu'au bout du tunnel. C'est le prix d'acquisition,
-- comparable à une campagne Meta sur ce marché.
-- ============================================================

-- ------------------------------------------------------------
-- 1. gift_key : trace l'offre de bienvenue dans le journal.
--
-- NULL sur toutes les lignes existantes et sur toutes les lignes
-- futures hors offre : la colonne est donc 100 % nullable et
-- n'affecte aucune requête existante (aucun SELECT * sur cette
-- table côté applicatif — vérifié dans lib/tokens.ts et
-- components/dashboard).
-- ============================================================

alter table public.token_transactions
  add column if not exists gift_key text;

create index if not exists token_transactions_gift_idx
  on public.token_transactions (gift_key)
  where gift_key is not null;

comment on column public.token_transactions.gift_key is
  'Motif de l''offre de bienvenue (gift:first_brief, gift:first_contact). NULL = aucune offre.';

-- ------------------------------------------------------------
-- 2. Vue de contrôle : qui a déjà consommé son offre ?
-- ------------------------------------------------------------

create or replace view public.welcome_offer_status
with (security_invoker = true)
as
select
  auth.uid() as user_id,
  exists (
    select 1
    from public.requests r
    where r.client_id = auth.uid()
  ) as has_published_brief,
  -- On compte la table unlocks (et non le journal) car un déblocage sur
  -- un brief de démonstration ne génère aucune transaction : c'est
  -- exactement le même critère que le contrôle serveur dans
  -- unlock_and_start_chat.
  exists (
    select 1
    from public.unlocks u
    where u.developer_id = auth.uid()
  ) as has_unlocked_contact,
  exists (
    select 1
    from public.token_transactions t
    where t.developer_id = auth.uid()
      and t.gift_key is not null
  ) as gift_consumed;

comment on view public.welcome_offer_status is
  'État de l''offre de bienvenue du compte connecté (lecture seule).';

grant select on public.welcome_offer_status to authenticated;

-- ------------------------------------------------------------
-- 2. Helper interne : le compte a-t-il déjà consommé son offre ?
--    Volontairement STABLE (non security definer) : appelé depuis
--    une fonction security definer, il s'exécute déjà avec les
--    droits du propriétaire de la fonction appelante.
-- ------------------------------------------------------------

create or replace function public.consumed_welcome_offer()
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.token_transactions t
    where t.developer_id = auth.uid()
      and t.gift_key is not null
  );
$$;

revoke all on function public.consumed_welcome_offer() from public, anon;
grant execute on function public.consumed_welcome_offer() to authenticated;

-- ------------------------------------------------------------
-- 3. publish_brief : le 1er brief d'un compte est offert.
--
--    Le contrôle est AVANT le contrôle de solde : un nouveau client
--    sans aucun Token doit pouvoir publier. Si le compte a déjà
--    publié une fois, le comportement normal (1 Token débité)
--    s'applique.
-- ------------------------------------------------------------

create or replace function public.publish_brief(
  p_client_name text,
  p_client_whatsapp text,
  p_client_city text,
  p_project_type text,
  p_budget integer,
  p_description text,
  p_features jsonb default '[]'::jsonb,
  p_deadline text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_balance integer;
  v_req public.requests%rowtype;
  v_gift boolean;
  v_brief_number integer;
begin
  if v_user_id is null then
    raise exception 'Connectez-vous pour publier un brief.' using errcode = 'TLAUTH';
  end if;

  if p_client_name is null or length(btrim(p_client_name)) < 2 then
    raise exception 'Nom du client manquant.' using errcode = 'TLBAD';
  end if;
  if p_client_whatsapp is null or p_client_whatsapp = '' then
    raise exception 'Numéro WhatsApp manquant.' using errcode = 'TLBAD';
  end if;
  if p_budget is null or p_budget < 10000 then
    raise exception 'Budget invalide (minimum 10000 F).' using errcode = 'TLBAD';
  end if;
  if p_project_type not in ('vitrine', 'e-commerce', 'landing page', 'app web', 'refonte') then
    raise exception 'Type de projet invalide.' using errcode = 'TLBAD';
  end if;

  -- Verrou sur la ligne du demandeur : sérialise deux publications
  -- simultanées du même compte, donc un seul brief offert.
  perform 1 from public.developers where id = v_user_id for update;

  select count(*)::integer
    into v_brief_number
    from public.requests r
   where r.client_id = v_user_id;

  -- Offre de bienvenue : premier brief du compte, et le compte n'a
  -- jamais consommé d'offre (donc pas non plus de contact offert).
  v_gift := (v_brief_number = 0) and not public.consumed_welcome_offer();

  if not v_gift then
    select coalesce(sum(t.amount), 0)::integer into v_balance
      from public.token_transactions t
     where t.developer_id = v_user_id;

    if v_balance < 1 then
      raise exception 'Tokens insuffisants. Rechargez vos Tokens pour publier un brief (1 Token).' using errcode = 'TLLOW';
    end if;
  end if;

  insert into public.requests (
    client_name, client_whatsapp, client_city, project_type, budget, description,
    client_id, features, deadline
  ) values (
    p_client_name,
    p_client_whatsapp,
    p_client_city,
    p_project_type,
    p_budget,
    p_description,
    v_user_id,
    coalesce(p_features, '[]'::jsonb),
    p_deadline
  )
  returning * into v_req;

  if v_gift then
    -- 0 Token : on trace l'offre au lieu de la débiter, ce qui garde
    -- l'historique lisible côté admin et permet de mesurer le coût.
    insert into public.token_transactions (developer_id, amount, type, request_id, gift_key)
    values (v_user_id, 0, 'bonus', v_req.id, 'gift:first_brief');
  else
    insert into public.token_transactions (developer_id, amount, type, request_id)
    values (v_user_id, -1, 'publish', v_req.id);
  end if;

  return jsonb_build_object(
    'id', v_req.id,
    'management_key', v_req.management_key,
    'gift', v_gift,
    'balance', (
      select coalesce(sum(t.amount), 0)::integer
      from public.token_transactions t
      where t.developer_id = v_user_id
    )
  );
end;
$$;

grant execute on function public.publish_brief(text, text, text, text, integer, text, jsonb, text) to authenticated;

-- ------------------------------------------------------------
-- 4. unlock_and_start_chat : le 1er contact déblocé est offert.
--
--    Même logique : le contrôle de solde saute si le compte n'a
--    jamais consommé d'offre ET n'a jamais débloqué de contact.
--    Le verrou existant sur la ligne du développeur sérialise
--    déjà deux déblocages concurrents.
--
--    Les briefs de démonstration (demo) ne sont jamais débités,
--    comme avant cette migration.
-- ------------------------------------------------------------

create or replace function public.unlock_and_start_chat(
  p_request_id uuid,
  p_initial_message text,
  p_estimated_price integer,
  p_estimated_days integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_dev public.developers%rowtype;
  v_req public.requests%rowtype;
  v_balance integer;
  v_conv uuid;
  v_first boolean := false;
  v_demo boolean := false;
  v_gift boolean := false;
  v_unlock_count integer;
begin
  if v_user_id is null then
    raise exception 'Connectez-vous pour débloquer un contact.' using errcode = 'TLNAU';
  end if;

  select * into v_dev from public.developers where id = v_user_id;
  if v_dev.id is null then
    raise exception 'Profil développeur requis.' using errcode = 'TLNOD';
  end if;
  if v_dev.status not in ('active', 'verified') then
    if v_dev.status = 'pending' then
      raise exception 'Votre compte développeur est en attente de validation.' using errcode = 'TLPEN';
    end if;
    raise exception 'Votre compte développeur ne permet pas de débloquer des contacts.' using errcode = 'TLRJC';
  end if;

  select * into v_req from public.requests where id = p_request_id for update;
  if v_req.id is null then
    raise exception 'Ce brief n''existe pas.' using errcode = 'TLNOR';
  end if;
  if v_req.status <> 'ouvert' then
    raise exception 'Ce brief n''est plus disponible.' using errcode = 'TLCLO';
  end if;

  v_demo := coalesce(v_req.demo, false);

  select c.id into v_conv
    from public.conversations c
   where c.request_id = p_request_id and c.developer_id = v_user_id;

  if v_conv is null then
    if v_req.current_unlocks_count >= v_req.max_unlocks then
      raise exception 'Ce brief a déjà atteint le nombre maximal de développeurs en contact.' using errcode = 'TLLIM';
    end if;

    if exists (
      select 1 from public.unlocks
      where developer_id = v_user_id and request_id = p_request_id
    ) then
      null;
    else
      if not v_demo then
        perform 1 from public.developers where id = v_user_id for update;

        select count(*)::integer
          into v_unlock_count
          from public.unlocks u
         where u.developer_id = v_user_id;

        -- Offre de bienvenue : tout premier déblocage du compte.
        v_gift := (v_unlock_count = 0) and not public.consumed_welcome_offer();

        if not v_gift then
          select coalesce(sum(t.amount), 0)::integer into v_balance
            from public.token_transactions t
           where t.developer_id = v_user_id;

          if v_balance < 1 then
            raise exception 'Tokens insuffisants. Rechargez vos Tokens.' using errcode = 'TLLOW';
          end if;

          insert into public.token_transactions (developer_id, amount, type, request_id)
          values (v_user_id, -1, 'unlock', p_request_id);
        else
          insert into public.token_transactions (developer_id, amount, type, request_id, gift_key)
          values (v_user_id, 0, 'bonus', p_request_id, 'gift:first_contact');
        end if;
      end if;

      insert into public.unlocks (developer_id, request_id)
      values (v_user_id, p_request_id);

      update public.requests
         set current_unlocks_count = current_unlocks_count + 1
       where id = p_request_id;

      v_first := true;
    end if;

    insert into public.conversations (request_id, developer_id, client_id)
    values (p_request_id, v_user_id, v_req.client_id)
    on conflict (request_id, developer_id) do nothing
    returning id into v_conv;

    if v_conv is null then
      select c.id into v_conv
        from public.conversations c
       where c.request_id = p_request_id and c.developer_id = v_user_id;
    end if;
  end if;

  if nullif(btrim(coalesce(p_initial_message, '')), '') is not null then
    insert into public.messages (
      conversation_id, sender_id, content, message_type, metadata
    ) values (
      v_conv,
      v_user_id,
      btrim(p_initial_message),
      'text',
      jsonb_build_object(
        'kind', 'initial_proposal',
        'estimated_price_fcfa', nullif(p_estimated_price, 0),
        'estimated_days', nullif(p_estimated_days, 0)
      )
    );

    update public.conversations
       set last_message_at = now()
     where id = v_conv;
  end if;

  -- Clés de retour identiques à 0025 (le front les lit par nom) :
  -- on AJOUTE seulement 'gift' pour que l'UI puisse dire « offert ».
  return jsonb_build_object(
    'conversation_id', v_conv,
    'first_unlock', v_first,
    'demo', v_demo,
    'gift', v_gift,
    'cost', case when v_demo or v_gift then 0 else 1 end,
    'balance', (
      select coalesce(sum(t.amount), 0)::integer
      from public.token_transactions t
      where t.developer_id = v_user_id
    )
  );
end;
$$;

grant execute on function public.unlock_and_start_chat(uuid, text, integer, integer) to authenticated;