-- A visit fully covered by a prepaid package has nothing left to pay. It is closed with this method so reports never call it cash.
-- (A new enum value cannot be used in the same transaction that adds it, so this is its own migration.)
alter type pay_method add value if not exists 'package';
