-- findastay — lock private tables at the grant layer (run once).
-- Anon must never read pricing thresholds, seasonal periods, offers or leads.

revoke all on fs_room_thresholds, fs_pricing_periods, fs_period_room_rates from anon, authenticated;
revoke all on fs_offers from anon;
revoke all on fs_listing_leads from anon, authenticated;

-- Re-grant only what each role legitimately needs (RLS still gates the rows):
grant select, insert, update, delete on fs_room_thresholds, fs_pricing_periods,
  fs_period_room_rates to authenticated;      -- RLS restricts to the owning business
grant select, insert, update on fs_offers to authenticated;
grant insert on fs_listing_leads to anon, authenticated;  -- can create a lead, cannot read them

notify pgrst, 'reload schema';
