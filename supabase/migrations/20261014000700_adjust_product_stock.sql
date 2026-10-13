-- Atomic stock change from the Products screen (never below zero). RLS limits it to the caller's salon.
create or replace function adjust_product_stock(p_product uuid, p_delta int) returns int
language sql security invoker set search_path = public as $$
  update products set stock = greatest(0, stock + p_delta) where id = p_product returning stock
$$;
revoke all on function adjust_product_stock(uuid, int) from public, anon;
grant execute on function adjust_product_stock(uuid, int) to authenticated;
