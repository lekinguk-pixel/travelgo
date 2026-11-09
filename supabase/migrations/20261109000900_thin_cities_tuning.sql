-- The first wide pass let in sports events, suburbs and economic zones. Pass 2 now keeps the
-- same "is it a sight?" test as pass 1, adds natural places (gorges, reserves, salt pans,
-- volcanoes...), and only loosens the radius, photo and popularity requirements.
create or replace function public._is_sight_relaxed(p_types text)
returns boolean language sql immutable set search_path = '' as $$
  with t as (select lower(x) as ty from unnest(string_to_array(coalesce(p_types, ''), '|')) x)
  select (public._is_sight(p_types)
          or exists (select 1 from t where ty ~ '(gorge|canyon|valley|reserve|protected area|nature park|national park|landscape park|lagoon|reef|volcano|crater|cenote|salt (pan|flat|evaporation)|saltworks|glacier|fjord|cliff|dune|hot spring|geyser|forest|hillfort|archaeological site|ancient city|historic site|house museum|birthplace)'))
     and not public._is_blocked(p_types)
     and not exists (select 1 from t where ty ~ '(championship|contest|competition|revolt|uprising|eyalet|economic zone|free zone|terminal|fsru|lng|velodrome|ice rink|ice stadium|airport|airfield|railway station|bobsleigh|race track|hotel|resort|casino|shopping|mall|office|residential|business|bank|school|hospital|prison|military|power station|factory)');
$$;
revoke execute on function public._is_sight_relaxed(text) from public, anon, authenticated;
