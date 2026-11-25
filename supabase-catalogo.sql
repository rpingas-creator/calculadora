-- Executar uma vez no Supabase (SQL Editor). Permite ao catálogo saber que artigos existem
-- na calculadora. Devolve APENAS fornecedor, referência e nome (nunca custos).
create or replace function public.catalogo_lista(de int default 0, n int default 1000)
returns table(sup text, ref text, name text)
language sql stable security definer set search_path = public as $$
  select p.sup, p.ref, p.name from products p order by p.id offset de limit n
$$;
revoke all on function public.catalogo_lista(int, int) from public;
grant execute on function public.catalogo_lista(int, int) to anon, authenticated;
