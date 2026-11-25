-- Server-side public pagination, filtering, and stats RPCs to prevent full-table downloads
-- and minimize PostgREST egress on free tier.

CREATE OR REPLACE FUNCTION public.is_public_company_career_job(p_source_name text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(trim(coalesce(p_source_name, ''))) LIKE ANY (ARRAY[
    '%direct company website%',
    '%official company website%',
    '%company career portal%',
    '%company careers%'
  ]);
$$;

CREATE OR REPLACE FUNCTION public.is_public_external_aggregator_job(
  p_source_name text,
  p_source_url text,
  p_apply_link text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(concat_ws(' ', p_source_name, p_source_url, p_apply_link)) ~ '(naukri|linkedin|indeed|glassdoor|shine\.com|foundit|monsterindia|timesjobs)';
$$;

CREATE OR REPLACE FUNCTION public.is_public_direct_job(
  p_created_by uuid,
  p_apply_mode text,
  p_source_name text,
  p_source_url text,
  p_apply_link text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN public.is_public_company_career_job(p_source_name) THEN false
    WHEN p_created_by IS NOT NULL THEN true
    WHEN p_apply_mode = 'internal' THEN true
    WHEN public.is_public_external_aggregator_job(p_source_name, p_source_url, p_apply_link) THEN false
    WHEN trim(coalesce(p_source_name, '')) <> '' THEN true
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.is_public_visible_job(
  p_status text,
  p_expires_at timestamptz,
  p_posted_at timestamptz,
  p_created_by uuid,
  p_apply_mode text,
  p_source_name text,
  p_source_url text,
  p_apply_link text
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    p_status = 'published'
    AND (p_expires_at IS NULL OR p_expires_at > NOW())
    AND p_posted_at IS NOT NULL
    AND (
      CASE
        WHEN public.is_public_direct_job(p_created_by, p_apply_mode, p_source_name, p_source_url, p_apply_link)
          THEN p_posted_at >= NOW() - INTERVAL '180 days'
        ELSE p_posted_at >= NOW() - INTERVAL '30 days'
      END
    );
$$;

CREATE OR REPLACE FUNCTION public.is_public_it_job(
  p_category text,
  p_job_type text,
  p_title text,
  p_skills text[],
  p_short_description text,
  p_description text
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  cat_low text := lower(trim(coalesce(p_category, '')));
  type_low text := lower(trim(coalesce(p_job_type, '')));
  cat_type text := cat_low || ' ' || type_low;
  hay text;
BEGIN
  IF cat_low IN ('it & software', 'it', 'software', 'information technology', 'developer', 'programming', 'tech')
     OR cat_low ~ '(^|[^a-z])(it|software|information technology)([^a-z]|$)' AND cat_low !~* 'non-?\s*it' THEN
    RETURN true;
  END IF;

  -- Explicit non-IT canonical categories exclude from IT unless untyped/General
  IF cat_low IN (
    'civil engineering', 'mechanical engineering', 'electrical / eee', 'ece / electronics',
    'banking & finance', 'bpo / customer support', 'sales & marketing', 'hr & admin',
    'healthcare', 'education', 'hospitality & retail', 'logistics & supply chain'
  ) THEN
    RETURN false;
  END IF;

  IF cat_type !~* 'non-?\s*it' AND (
    cat_type LIKE '%it &%' OR cat_type LIKE '%it&%' OR cat_type LIKE '%information technology%'
    OR cat_type LIKE '%software%' OR cat_type LIKE '%developer%' OR cat_type LIKE '%programming%'
    OR cat_type LIKE '%technical%' OR cat_type ~ '(^|\s)it(\s|$)'
  ) THEN
    RETURN true;
  END IF;

  hay := lower(concat_ws(' ', p_title, p_category, p_job_type, array_to_string(p_skills, ' '), p_short_description, left(coalesce(p_description, ''), 1200)));

  RETURN hay ~ '(^|[^a-z0-9])(java|python|javascript|typescript|react|angular|vue|node\.js|node|sql|aws|azure|gcp|kubernetes|docker|spring|\.net|dotnet|c#|c\+\+|golang|ruby|php|swift|kotlin|scala|rust|software|developer|programmer|full stack|fullstack|frontend|front-end|backend|back-end|devops|sde|data engineer|data scientist|machine learning|ai engineer|cloud|network engineer|database admin|dba|qa engineer|test automation|selenium|cyber security|it support|system admin|linux admin|information technology|android|ios|flutter|django|flask|next\.js|nestjs|graphql|mongodb|postgres|redis|terraform|jenkins)([^a-z0-9]|$)';
END;
$$;

CREATE OR REPLACE FUNCTION public.matches_public_job_category(
  p_wanted text,
  p_category text,
  p_job_type text,
  p_title text,
  p_skills text[],
  p_short_description text,
  p_description text,
  p_experience text,
  p_is_fresher boolean
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  w text := lower(trim(coalesce(p_wanted, 'all')));
  cat_low text := lower(trim(coalesce(p_category, '')));
  exp_low text := lower(trim(coalesce(p_experience, '')));
  hay text;
BEGIN
  IF w = '' OR w = 'all' THEN
    RETURN true;
  END IF;

  IF w = 'it' THEN
    RETURN public.is_public_it_job(p_category, p_job_type, p_title, p_skills, p_short_description, p_description);
  END IF;

  IF w = 'non-it' THEN
    RETURN NOT public.is_public_it_job(p_category, p_job_type, p_title, p_skills, p_short_description, p_description);
  END IF;

  IF w = 'fresher' THEN
    RETURN coalesce(p_is_fresher, false) = true
      OR exp_low ~ '(^|[^0-9])0([^0-9]|$)'
      OR exp_low LIKE '0%';
  END IF;

  hay := lower(concat_ws(' ', p_title, p_category, p_job_type, array_to_string(p_skills, ' '), p_short_description, left(coalesce(p_description, ''), 1200)));

  IF w = 'walk-in' THEN
    RETURN hay ~ 'walk-?\s*in|walkin';
  END IF;

  IF w = 'civil' THEN
    RETURN cat_low ~ '(civil|construction|structural)'
      OR hay ~ '(civil engineer|civil engineering|structural engineer|construction engineer|site engineer|estimation engineer|quantity survey|autocad civil)';
  END IF;

  IF w = 'mechanical' THEN
    RETURN cat_low ~ '(mechanical|production|manufacturing)'
      OR hay ~ '(mechanical engineer|mechanical engineering|hvac engineer|piping engineer|maintenance engineer|production engineer|tool design|autocad mechanical|cnc operator|plant engineer)';
  END IF;

  IF w = 'electrical' THEN
    RETURN cat_low ~ '(electrical|eee|power)'
      OR hay ~ '(electrical engineer|electrical engineering|eee engineer|power plant|substation|switchgear|plc scada|electrical maintenance)';
  END IF;

  IF w = 'ece' THEN
    RETURN cat_low ~ '(ece|electronics|communication|embedded)'
      OR hay ~ '(^|[^a-z0-9])ece([^a-z0-9]|$)'
      OR hay ~ '(electronics engineer|electronics and communication|embedded engineer|vlsi|fpga|pcb design|telecom engineer)';
  END IF;

  IF w = 'engineering' THEN
    RETURN public.matches_public_job_category('civil', p_category, p_job_type, p_title, p_skills, p_short_description, p_description, p_experience, p_is_fresher)
      OR public.matches_public_job_category('mechanical', p_category, p_job_type, p_title, p_skills, p_short_description, p_description, p_experience, p_is_fresher)
      OR public.matches_public_job_category('electrical', p_category, p_job_type, p_title, p_skills, p_short_description, p_description, p_experience, p_is_fresher)
      OR public.matches_public_job_category('ece', p_category, p_job_type, p_title, p_skills, p_short_description, p_description, p_experience, p_is_fresher)
      OR hay ~ '(diploma engineer|graduate engineer trainee|get engineer|instrumentation engineer|project engineer|design engineer)';
  END IF;

  IF w = 'banking' THEN
    RETURN cat_low ~ '(banking|finance|accountant|accounts|nbfc|insurance)'
      OR hay ~ '(^|[^a-z0-9])(bank|banking|nbfc|accountant|finance|insurance|tally|gst)([^a-z0-9]|$)';
  END IF;

  IF w = 'bpo' THEN
    RETURN cat_low ~ '(bpo|customer support|call center|voice process|telecaller)'
      OR hay ~ '(bpo|customer support|call center|voice process|telecaller|customer care|csr)';
  END IF;

  IF w = 'sales' THEN
    RETURN cat_low ~ '(sales|marketing|business development|bde)'
      OR hay ~ '(sales|marketing|business development|bde|field sales)';
  END IF;

  IF w = 'hr' THEN
    RETURN cat_low ~ '(hr|human resources|recruitment|admin|back office|office assistant)'
      OR hay ~ '(hr executive|human resources|recruiter|talent acquisition|admin executive|back office|office assistant)';
  END IF;

  IF w = 'healthcare' THEN
    RETURN cat_low ~ '(healthcare|medical|nurse|pharma|hospital|lab technician)'
      OR hay ~ '(healthcare|medical|nurse|pharmacist|pharma|hospital|lab technician)';
  END IF;

  IF w = 'education' THEN
    RETURN cat_low ~ '(education|teacher|faculty|tutor|teaching)'
      OR hay ~ '(education|teacher|faculty|professor|tutor|lecturer|teaching)';
  END IF;

  IF w = 'hospitality' THEN
    RETURN cat_low ~ '(hospitality|hotel|retail|store|restaurant|front office)'
      OR hay ~ '(hospitality|hotel|retail|store manager|cashier|front office|restaurant)';
  END IF;

  IF w = 'logistics' THEN
    RETURN cat_low ~ '(logistics|supply chain|warehouse|delivery|driver|fleet)'
      OR hay ~ '(logistics|supply chain|warehouse|delivery|driver|fleet)';
  END IF;

  RETURN cat_low = w OR cat_low LIKE '%' || w || '%';
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_job_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT jsonb_build_object(
    'activeJobs', count(*),
    'companies', count(DISTINCT nullif(lower(trim(company)), '')),
    'newThisWeek', count(*) FILTER (WHERE posted_at >= NOW() - INTERVAL '7 days'),
    'categories', count(DISTINCT nullif(trim(category), '')),
    'postedToday', count(*) FILTER (WHERE posted_at >= NOW() - INTERVAL '24 hours'),
    'directCount', count(*) FILTER (WHERE public.is_public_direct_job(created_by, apply_mode, source_name, source_url, apply_link)),
    'companyCount', count(*) FILTER (WHERE public.is_public_company_career_job(source_name))
  )
  FROM public.jobs
  WHERE public.is_public_visible_job(status, expires_at, posted_at, created_by, apply_mode, source_name, source_url, apply_link);
$$;

CREATE OR REPLACE FUNCTION public.query_public_jobs(
  p_tab text DEFAULT 'all',
  p_category text DEFAULT 'all',
  p_job_type text DEFAULT 'all',
  p_freshness text DEFAULT 'all',
  p_source text DEFAULT 'all',
  p_company text DEFAULT '',
  p_search text DEFAULT '',
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 12
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
DECLARE
  v_tab text := lower(trim(coalesce(p_tab, 'all')));
  v_category text := lower(trim(coalesce(p_category, 'all')));
  v_job_type text := lower(trim(regexp_replace(coalesce(p_job_type, 'all'), '[\s_]+', '-', 'g')));
  v_freshness text := lower(trim(coalesce(p_freshness, 'all')));
  v_source text := lower(trim(coalesce(p_source, 'all')));
  v_company text := lower(trim(regexp_replace(coalesce(p_company, ''), '\s+', ' ', 'g')));
  v_raw_search text := trim(coalesce(p_search, ''));
  v_clean_search text;
  v_search_tokens text[];
  v_source_list text[];
  v_min_freshness timestamptz := NULL;
  v_page_size integer := greatest(1, least(coalesce(p_page_size, 12), 100));
  v_page integer := greatest(1, coalesce(p_page, 1));
  v_total integer := 0;
  v_total_pages integer := 1;
  v_offset integer := 0;
  v_items jsonb := '[]'::jsonb;
BEGIN
  IF v_freshness = '24h' THEN
    v_min_freshness := NOW() - INTERVAL '24 hours';
  ELSIF v_freshness = '7d' THEN
    v_min_freshness := NOW() - INTERVAL '7 days';
  ELSIF v_freshness = '30d' THEN
    v_min_freshness := NOW() - INTERVAL '30 days';
  END IF;

  IF v_raw_search <> '' THEN
    v_clean_search := trim(regexp_replace(
      regexp_replace(lower(v_raw_search), '\m(pvt\.?\s*ltd\.?|private\s+limited|limited|ltd\.?|llp|inc\.?|corp\.?|corporation)\M', '', 'gi'),
      '[,.\-–—\s]+$', '', 'g'
    ));
    IF v_clean_search = '' THEN
      v_clean_search := lower(v_raw_search);
    END IF;
    v_search_tokens := regexp_split_to_array(trim(v_clean_search), '\s+');
  END IF;

  IF v_source <> '' AND v_source <> 'all' THEN
    v_source_list := string_to_array(v_source, ',');
  END IF;

  WITH base_filtered AS (
    SELECT j.*
    FROM public.jobs j
    WHERE
      public.is_public_visible_job(j.status, j.expires_at, j.posted_at, j.created_by, j.apply_mode, j.source_name, j.source_url, j.apply_link)
      AND (
        v_tab = 'all'
        OR (v_tab = 'direct' AND public.is_public_direct_job(j.created_by, j.apply_mode, j.source_name, j.source_url, j.apply_link))
        OR (v_tab = 'company' AND public.is_public_company_career_job(j.source_name))
      )
      AND (
        v_company = ''
        OR lower(trim(regexp_replace(coalesce(j.company, ''), '\s+', ' ', 'g'))) = v_company
      )
      AND (
        v_min_freshness IS NULL
        OR (j.posted_at IS NOT NULL AND j.posted_at >= v_min_freshness)
      )
      AND (
        v_job_type = 'all' OR v_job_type = ''
        OR (
          CASE
            WHEN v_job_type = 'internship' THEN lower(regexp_replace(coalesce(j.job_type, ''), '[\s_]+', '-', 'g')) LIKE 'intern%'
            WHEN v_job_type = 'full-time' THEN lower(regexp_replace(coalesce(j.job_type, ''), '[\s_]+', '-', 'g')) IN ('full-time', 'fulltime', 'full time')
            WHEN v_job_type = 'part-time' THEN lower(regexp_replace(coalesce(j.job_type, ''), '[\s_]+', '-', 'g')) IN ('part-time', 'parttime', 'part time')
            ELSE lower(regexp_replace(coalesce(j.job_type, ''), '[\s_]+', '-', 'g')) = v_job_type
          END
        )
      )
      AND (
        v_source_list IS NULL
        OR EXISTS (
          SELECT 1
          FROM unnest(v_source_list) s
          WHERE
            (s = 'employer' AND j.created_by IS NOT NULL)
            OR (s = 'naukri' AND j.created_by IS NULL AND lower(concat_ws(' ', j.source_name, j.source_url, j.apply_link)) LIKE '%naukri%')
            OR (s = 'indeed' AND j.created_by IS NULL AND lower(concat_ws(' ', j.source_name, j.source_url, j.apply_link)) LIKE '%indeed%')
            OR (s = 'linkedin' AND j.created_by IS NULL AND lower(concat_ws(' ', j.source_name, j.source_url, j.apply_link)) LIKE '%linkedin%')
            OR (s = 'linkedin_jobs' AND j.created_by IS NULL AND lower(concat_ws(' ', j.source_name, j.source_url, j.apply_link)) LIKE '%linkedin%' AND (lower(coalesce(j.source_url,'')) LIKE '%linkedin.com/jobs/%' OR lower(coalesce(j.apply_link,'')) LIKE '%linkedin.com/jobs/%' OR lower(coalesce(j.source_url,'')) LIKE '%/jobs/view%' OR lower(coalesce(j.apply_link,'')) LIKE '%/jobs/view%'))
            OR (s = 'linkedin_posts' AND j.created_by IS NULL AND lower(concat_ws(' ', j.source_name, j.source_url, j.apply_link)) LIKE '%linkedin%' AND NOT (lower(coalesce(j.source_url,'')) LIKE '%linkedin.com/jobs/%' OR lower(coalesce(j.apply_link,'')) LIKE '%linkedin.com/jobs/%' OR lower(coalesce(j.source_url,'')) LIKE '%/jobs/view%' OR lower(coalesce(j.apply_link,'')) LIKE '%/jobs/view%'))
            OR (s = 'admin' AND j.created_by IS NULL AND NOT public.is_public_external_aggregator_job(j.source_name, j.source_url, j.apply_link))
        )
      )
      AND public.matches_public_job_category(
        v_category,
        j.category,
        j.job_type,
        j.title,
        j.skills,
        j.short_description,
        j.description,
        j.experience,
        j.is_fresher
      )
      AND (
        v_search_tokens IS NULL
        OR (
          SELECT bool_and(
            lower(concat_ws(' ', j.title, j.company, array_to_string(j.skills, ' '), j.short_description, j.category, j.location, j.experience))
            LIKE '%' || tok || '%'
          )
          FROM unnest(v_search_tokens) tok
          WHERE tok <> ''
        )
      )
  ),
  counted AS (
    SELECT count(*)::integer AS cnt FROM base_filtered
  ),
  paged AS (
    SELECT
      j.is_quick_job,
      j.id,
      j.accepted_degrees,
      j.accepted_branches,
      j.required_education_status,
      j.required_experience,
      j.required_skills,
      j.preferred_skills,
      j.required_candidate_locations,
      j.accepts_relocation,
      j.requirements_verified,
      j.slug,
      j.title,
      j.company,
      j.location,
      j.category,
      j.role,
      j.job_type,
      j.work_mode,
      j.experience,
      j.is_fresher,
      j.is_featured,
      j.is_instagram,
      j.group_link,
      j.salary,
      j.short_description,
      j.skills,
      j.company_logo_url,
      j.source_name,
      j.source_url,
      j.created_by,
      j.apply_mode,
      j.application_count,
      j.apply_click_count,
      j.posted_at,
      j.expires_at,
      j.status
    FROM base_filtered j
    ORDER BY j.is_featured DESC NULLS LAST, j.posted_at DESC NULLS LAST, j.created_at DESC NULLS LAST
    LIMIT v_page_size
    OFFSET GREATEST(0, (LEAST(v_page, GREATEST(1, CEIL((SELECT cnt FROM counted)::numeric / v_page_size)::integer)) - 1) * v_page_size)
  )
  SELECT
    c.cnt,
    GREATEST(1, CEIL(c.cnt::numeric / v_page_size)::integer),
    LEAST(v_page, GREATEST(1, CEIL(c.cnt::numeric / v_page_size)::integer)),
    coalesce((SELECT jsonb_agg(to_jsonb(paged)) FROM paged), '[]'::jsonb)
  INTO v_total, v_total_pages, v_page, v_items
  FROM counted c;

  RETURN jsonb_build_object(
    'total', v_total,
    'page', v_page,
    'pageSize', v_page_size,
    'totalPages', v_total_pages,
    'items', v_items
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_public_company_career_job(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_public_external_aggregator_job(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_public_direct_job(uuid, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_public_visible_job(text, timestamptz, timestamptz, uuid, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_public_it_job(text, text, text, text[], text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.matches_public_job_category(text, text, text, text, text[], text, text, text, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_job_stats() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.query_public_jobs(text, text, text, text, text, text, text, integer, integer) TO anon, authenticated;
