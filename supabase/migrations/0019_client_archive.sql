create or replace function public.client_archive_conversation(p_conversation_id uuid)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_conv public.conversations%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Non autorisé' using errcode = 'TLNAUTH';
  end if;

  select * into v_conv
    from public.conversations
   where id = p_conversation_id;

  if v_conv.id is null then
    raise exception 'Discussion introuvable' using errcode = 'TLNOK';
  end if;

  if v_conv.client_id is distinct from auth.uid() then
    if not exists (
      select 1
        from public.requests r
       where r.id = v_conv.request_id
         and r.client_id = auth.uid()
    ) then
      raise exception 'Non autorisé' using errcode = 'TLNAUTH';
    end if;
  end if;

  if v_conv.status = 'archived' then
    return jsonb_build_object('ok', false, 'message', 'Déjà archivée.');
  end if;

  update public.conversations
     set status = 'archived'
   where id = v_conv.id;

  return jsonb_build_object('ok', true, 'id', v_conv.id);
end;
$$;