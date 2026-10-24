-- A client's link to the forms they need to complete before a visit.
alter type token_purpose add value if not exists 'fill_form';
