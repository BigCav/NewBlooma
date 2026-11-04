-- Housekeeping from the database advisor checks.
-- 1. One trigger function did not pin its search path.
-- 2. Every foreign key now has an index (joins and deletes on sales, sale items, inbox and bookings stay fast as a shop's history grows).
-- 3. The till_closes read policy called auth.uid() for every row; wrapping it in a select makes it run once per query.

alter function public.bookings_completed_is_final() set search_path = public;

create index if not exists booking_services_service_id_idx on public.booking_services (service_id);
create index if not exists booking_tokens_booking_id_idx on public.booking_tokens (booking_id);
create index if not exists booking_tokens_salon_id_idx on public.booking_tokens (salon_id);
create index if not exists booking_tokens_waitlist_id_idx on public.booking_tokens (waitlist_id);
create index if not exists card_payments_salon_id_idx on public.card_payments (salon_id);
create index if not exists client_notes_created_by_idx on public.client_notes (created_by);
create index if not exists client_notes_salon_id_idx on public.client_notes (salon_id);
create index if not exists client_packages_client_id_idx on public.client_packages (client_id);
create index if not exists client_packages_package_id_idx on public.client_packages (package_id);
create index if not exists client_packages_service_id_idx on public.client_packages (service_id);
create index if not exists form_submissions_booking_id_idx on public.form_submissions (booking_id);
create index if not exists form_submissions_recorded_by_idx on public.form_submissions (recorded_by);
create index if not exists form_submissions_salon_id_idx on public.form_submissions (salon_id);
create index if not exists form_submissions_template_id_idx on public.form_submissions (template_id);
create index if not exists form_template_categories_category_id_idx on public.form_template_categories (category_id);
create index if not exists inbox_items_booking_id_idx on public.inbox_items (booking_id);
create index if not exists inbox_items_client_id_idx on public.inbox_items (client_id);
create index if not exists inbox_messages_salon_id_idx on public.inbox_messages (salon_id);
create index if not exists notifications_outbox_salon_id_idx on public.notifications_outbox (salon_id);
create index if not exists package_uses_sale_id_idx on public.package_uses (sale_id);
create index if not exists package_uses_salon_id_idx on public.package_uses (salon_id);
create index if not exists payouts_salon_id_idx on public.payouts (salon_id);
create index if not exists reviews_client_id_idx on public.reviews (client_id);
create index if not exists reviews_staff_id_idx on public.reviews (staff_id);
create index if not exists sale_items_package_id_idx on public.sale_items (package_id);
create index if not exists sale_items_product_id_idx on public.sale_items (product_id);
create index if not exists sale_items_sale_id_idx on public.sale_items (sale_id);
create index if not exists sale_items_service_id_idx on public.sale_items (service_id);
create index if not exists sales_client_id_idx on public.sales (client_id);
create index if not exists sales_gift_card_id_idx on public.sales (gift_card_id);
create index if not exists sales_staff_id_idx on public.sales (staff_id);
create index if not exists service_addons_service_id_idx on public.service_addons (service_id);
create index if not exists service_packages_service_id_idx on public.service_packages (service_id);
create index if not exists service_staff_staff_id_idx on public.service_staff (staff_id);
create index if not exists services_category_id_idx on public.services (category_id);
create index if not exists staff_blocks_salon_id_idx on public.staff_blocks (salon_id);
create index if not exists staff_invites_salon_id_idx on public.staff_invites (salon_id);
create index if not exists staff_invites_staff_id_idx on public.staff_invites (staff_id);
create index if not exists till_closes_closed_by_idx on public.till_closes (closed_by);
create index if not exists timesheets_salon_id_idx on public.timesheets (salon_id);
create index if not exists waitlist_entries_added_by_idx on public.waitlist_entries (added_by);
create index if not exists waitlist_entries_booking_id_idx on public.waitlist_entries (booking_id);
create index if not exists waitlist_entries_offered_staff_id_idx on public.waitlist_entries (offered_staff_id);
create index if not exists waitlist_entries_service_id_idx on public.waitlist_entries (service_id);
create index if not exists waitlist_entries_staff_id_idx on public.waitlist_entries (staff_id);

drop policy if exists staff_read on public.till_closes;
create policy staff_read on public.till_closes for select to authenticated
  using (salon_id = current_salon_id() and exists (select 1 from staff s where s.user_id = (select auth.uid()) and s.active and s.app_role <> 'stylist'));
