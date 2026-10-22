-- Selling more of a product than is in stock is refused when the sale is made. Paying never fails (and never goes below zero) because the
-- check has already happened and another sale may have taken stock in between.
do $$
declare d text;
begin
  select pg_get_functiondef(oid) into d from pg_proc where pronamespace = 'public'::regnamespace and proname = 'create_sale';
  if position('insufficient_stock' in d) = 0 then
    d := replace(d, 'v_prod := v_prod + pr.price_cents * v_qty;', 'if pr.stock < v_qty then raise exception ''insufficient_stock''; end if;' || chr(10) || '    v_prod := v_prod + pr.price_cents * v_qty;');
    execute d;
  end if;
  select pg_get_functiondef(oid) into d from pg_proc where pronamespace = 'public'::regnamespace and proname = 'finalize_sale';
  if position('greatest(stock' in d) = 0 then
    d := replace(d, 'update products set stock = stock - it.qty', 'update products set stock = greatest(stock - it.qty, 0)');
    execute d;
  end if;
end $$;
