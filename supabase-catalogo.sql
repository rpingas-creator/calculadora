-- Executar uma vez no Supabase (SQL Editor). Permite ao catálogo saber que artigos existem
-- na calculadora. Devolve APENAS fornecedor, referência e nome (nunca custos).
create or replace function public.catalogo_lista(de int default 0, n int default 1000)
returns table(sup text, ref text, name text)
language sql stable security definer set search_path = public as $$
  select p.sup, p.ref, p.name from products p order by p.id offset de limit n
$$;
revoke all on function public.catalogo_lista(int, int) from public;
grant execute on function public.catalogo_lista(int, int) to anon, authenticated;

-- Versão 2: acrescenta cores e tamanhos (sem os custos por tamanho) para o catálogo mostrar o mesmo que a calculadora.
-- Executar uma vez no SQL Editor. O catálogo usa esta função e, se não existir, volta à anterior.
create or replace function public.catalogo_lista2(de int default 0, n int default 1000)
returns table(sup text, ref text, name text, colors text, sizes text)
language sql stable security definer set search_path = public as $$
  select p.sup, p.ref, p.name, p.colors,
         regexp_replace(coalesce(p.sizes,''), '\s*[:=]\s*[0-9]+([.,][0-9]+)?', '', 'g')
  from products p order by p.id offset de limit n
$$;
revoke all on function public.catalogo_lista2(int, int) from public;
grant execute on function public.catalogo_lista2(int, int) to anon, authenticated;
