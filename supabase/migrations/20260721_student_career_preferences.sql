-- Career preferences make student profiles searchable by target role/category.

alter table public.student_profiles
  add column if not exists target_job_categories text[] not null default '{}',
  add column if not exists primary_target_role text,
  add column if not exists role_experience_level text,
  add column if not exists preferred_locations text[] not null default '{}',
  add column if not exists availability text,
  add column if not exists expected_salary_min integer,
  add column if not exists expected_salary_max integer;

alter table public.student_profiles
  drop constraint if exists student_profiles_target_job_categories_check,
  add constraint student_profiles_target_job_categories_check
    check (
      target_job_categories <@ array[
        'software_frontend',
        'software_backend',
        'software_full_stack',
        'data_analytics',
        'testing_qa',
        'telecaller_bpo',
        'customer_support',
        'sales_marketing',
        'digital_marketing',
        'accounting_finance',
        'mechanical_production',
        'electrical_electronics',
        'civil_construction',
        'medical_healthcare',
        'pharma_lab',
        'delivery_logistics',
        'operations_admin',
        'teaching_training',
        'retail_hospitality',
        'other'
      ]::text[]
    );

alter table public.student_profiles
  drop constraint if exists student_profiles_role_experience_level_check,
  add constraint student_profiles_role_experience_level_check
    check (
      role_experience_level is null
      or role_experience_level in (
        'fresher',
        '0_6_months',
        '6_12_months',
        '1_2_years',
        '2_4_years',
        '4_plus_years'
      )
    );

alter table public.student_profiles
  drop constraint if exists student_profiles_availability_check,
  add constraint student_profiles_availability_check
    check (
      availability is null
      or availability in (
        'immediate',
        'within_15_days',
        'within_30_days',
        'more_than_30_days'
      )
    );

alter table public.student_profiles
  drop constraint if exists student_profiles_expected_salary_check,
  add constraint student_profiles_expected_salary_check
    check (
      (expected_salary_min is null or expected_salary_min > 0)
      and (expected_salary_max is null or expected_salary_max > 0)
      and (
        expected_salary_min is null
        or expected_salary_max is null
        or expected_salary_max >= expected_salary_min
      )
    );

create index if not exists student_profiles_target_job_categories_gin_idx
  on public.student_profiles using gin (target_job_categories);

create index if not exists student_profiles_primary_target_role_idx
  on public.student_profiles (lower(primary_target_role));
