-- Student applications increment jobs.application_count via a trigger.
-- That UPDATE was treated as an employer edit, so applying to admin jobs
-- (created_by is null) raised: "You can only edit your own job submissions."
-- Skip submission-rule enforcement when only denormalized counters change.

create or replace function public.enforce_job_submission_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin(auth.uid()) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.created_by is null then
      new.created_by := auth.uid();
    elsif new.created_by is distinct from auth.uid() then
      raise exception 'You can only submit jobs for your own account.';
    end if;

    new.status := 'pending';
    new.is_featured := false;
    new.reviewed_at := null;
    new.reviewed_by := null;
    new.rejection_reason := null;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if (
      to_jsonb(new) - 'application_count' - 'apply_click_count' - 'updated_at' - 'search_document'
    ) is not distinct from (
      to_jsonb(old) - 'application_count' - 'apply_click_count' - 'updated_at' - 'search_document'
    ) then
      return new;
    end if;

    if old.created_by is distinct from auth.uid() then
      raise exception 'You can only edit your own job submissions.';
    end if;

    if old.status not in ('pending', 'draft') then
      raise exception 'Only pending submissions can be edited.';
    end if;

    new.status := 'pending';
    new.is_featured := false;
    new.created_by := old.created_by;
    new.reviewed_at := null;
    new.reviewed_by := null;
    new.rejection_reason := null;
    return new;
  end if;

  return new;
end;
$$;
