import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { FORM_TEMPLATES } from "../src/lib/quickApply.js";
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const admin = "00000000-0000-0000-0000-000000000001";
const student = "00000000-0000-0000-0000-000000000002";
const employer = "00000000-0000-0000-0000-000000000003";
const stranger = "00000000-0000-0000-0000-000000000004";
try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
 create schema auth; create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create function auth.role() returns text language sql stable as $$ select current_setting('request.jwt.claim.role',true) $$;
 create function public.is_admin(uid uuid) returns boolean language sql stable as $$ select uid='${admin}'::uuid $$;
 create table jobs(id uuid primary key default gen_random_uuid(),slug text unique,title text,company text,location text,category text,role text,job_type text,salary text,description text,short_description text,apply_mode text,status text,created_by uuid,expires_at timestamptz);
 create function public.can_view_job_applications(jid uuid, uid uuid) returns boolean language sql stable as $$ select exists(select 1 from jobs where id=jid and created_by=uid) $$;
 create table employer_profiles(user_id uuid,company_name text,is_active boolean);
 create table student_profiles(user_id uuid,full_name text,phone text,contact_email text,college text,degree text,branch text,graduation_year integer,skills text[],is_fresher boolean,resume_path text,is_active boolean);
 create table job_applications(id uuid primary key default gen_random_uuid(),job_id uuid references jobs(id),student_user_id uuid not null references auth.users(id),status text,cover_note text,resume_path text,resume_share_token text default gen_random_uuid()::text,profile_snapshot jsonb,recruiter_notes text,interview_scheduled_at timestamptz,interview_mode text,interview_location text,interview_instructions text,submitted_at timestamptz default now(),updated_at timestamptz default now(),unique(job_id,student_user_id));
 create table job_apply_clicks(id uuid,job_id uuid,user_id uuid,created_at timestamptz);
 insert into auth.users values('${admin}'),('${student}'),('${employer}'),('${stranger}');
 insert into student_profiles(user_id,full_name,is_active) values('${student}','Test Student',true);
 insert into employer_profiles values('${employer}','Test Employer',true);`);
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/20261008120000_quick_applications.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/20261008123000_quick_receipt_job_binding.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/20261008130000_quick_candidate_review.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/20261008131500_quick_service_form_access.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  async function identity(uid, role = "authenticated") {
    await db.query(
      "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role',$2,false)",
      [uid, role],
    );
  }
  async function create(title, owner = "") {
    await identity(admin);
    return (
      await db.query("select save_quick_job($1,$2) id", [
        JSON.stringify({
          title,
          role: "Delivery",
          location: "Vizag",
          salary: "15000",
          description: "Deliver orders around Vizag",
          owner_id: owner,
        }),
        JSON.stringify(FORM_TEMPLATES.Delivery),
      ])
    ).rows[0].id;
  }
  const job = await create("Delivery riders", employer);
  const second = await create("Delivery evening shift");
  const publicForm = (await db.query("select get_quick_job($1) form", [job]))
    .rows[0].form;
  assert.equal(publicForm.fields.length, 5);
  assert.equal(publicForm.company, "Test Employer");
  await identity(stranger);
  await assert.rejects(
    db.query("select save_quick_job($1,$2)", [
      JSON.stringify({}),
      JSON.stringify(FORM_TEMPLATES.Basic),
    ]),
    /Admin access/,
  );
  await assert.rejects(
    db.query("select * from get_job_applicant_records($1)", [job]),
    /Not authorized/,
  );
  await assert.rejects(
    db.query("select * from update_job_applicant_stage($1)", [job]),
    /Not authorized/,
  );
  const answers = {
    full_name: "Test Guest",
    phone: "+919876543210",
    location: "Vizag",
    vehicle: "Yes",
    licence: "Yes",
  };
  async function submit(jid, token, values = answers) {
    await identity("", "service_role");
    const form = (await db.query("select get_quick_job($1) form", [jid]))
      .rows[0].form;
    return (
      await db.query(
        "select submit_quick_application($1,$2,$3,$4,$5,$6) result",
        [
          jid,
          form.form_id,
          JSON.stringify(values),
          token,
          "instagram",
          "test-ip",
        ],
      )
    ).rows[0].result;
  }
  await identity("", "service_role");
  await db.exec("set role service_role");
  assert.ok(
    (await db.query("select get_quick_job($1) form", [job])).rows[0].form,
  );
  await db.exec("reset role");
  const receipt = "a".repeat(64);
  assert.equal((await submit(job, receipt)).claimable, true);
  assert.equal((await submit(job, receipt)).claimable, true);
  assert.equal((await submit(job, "b".repeat(64))).claimable, false);
  assert.equal(
    (await db.query("select count(*)::int n from job_applications")).rows[0].n,
    1,
  );
  await assert.rejects(submit(second, receipt), /Invalid submission receipt/);
  await submit(second, "c".repeat(64));
  assert.equal(
    (await db.query("select count(*)::int n from quick_candidates")).rows[0].n,
    1,
  );
  await identity(employer);
  const apps = (
    await db.query("select * from get_job_applicant_records($1)", [job])
  ).rows;
  assert.equal(apps.length, 1);
  assert.equal(apps[0].full_name, "Test Guest");
  assert.equal(apps[0].user_id, null);
  await db.query(
    "select * from update_job_applicant_stage(p_job_id=>$1,p_candidate_id=>$2,p_status=>'screened',p_recruiter_notes=>'Call tomorrow')",
    [job, apps[0].id],
  );
  await assert.rejects(
    db.query("select * from get_job_applicant_records($1)", [second]),
    /Not authorized/,
  );
  await identity(student);
  assert.equal(
    (await db.query("select claim_quick_applications($1) n", [[receipt]]))
      .rows[0].n,
    1,
  );
  assert.equal(
    (await db.query("select claim_quick_applications($1) n", [[receipt]]))
      .rows[0].n,
    0,
  );
  const linked = (
    await db.query("select * from job_applications where job_id=$1", [job])
  ).rows[0];
  assert.equal(linked.student_user_id, student);
  assert.equal(linked.status, "screened");
  assert.equal(linked.recruiter_notes, "Call tomorrow");
  assert.equal(
    (
      await db.query(
        "select student_user_id from job_applications where job_id=$1",
        [second],
      )
    ).rows[0].student_user_id,
    null,
  );
  await identity(stranger);
  await assert.rejects(
    db.query("select admin_link_quick_application($1,$2,true)", [
      apps[0].id,
      student,
    ]),
    /Admin access/,
  );
  await identity(admin);
  const guestId = (
    await db.query("select id from job_applications where job_id=$1", [second])
  ).rows[0].id;
  await assert.rejects(
    db.query("select admin_link_quick_application($1,$2,false)", [
      guestId,
      student,
    ]),
    /Confirm account/,
  );
  await db.query("select admin_link_quick_application($1,$2,true)", [
    guestId,
    student,
  ]);
  assert.equal(
    (
      await db.query(
        "select student_user_id from job_applications where id=$1",
        [guestId],
      )
    ).rows[0].student_user_id,
    student,
  );
  await identity("", "anon");
  await assert.rejects(
    db.query("select submit_quick_application($1,$2,$3,$4,$5,$6)", [
      job,
      publicForm.form_id,
      JSON.stringify(answers),
      "d".repeat(64),
      "direct",
      "ip",
    ]),
    /Server access/,
  );
  await db.exec("set role anon");
  await assert.rejects(
    db.exec("select * from quick_candidates"),
    /permission denied/,
  );
  await assert.rejects(
    db.exec("select * from quick_application_receipts"),
    /permission denied/,
  );
  await db.exec("reset role");
  await identity(admin);
  await db.query("update quick_job_forms set is_open=false where job_id=$1", [
    second,
  ]);
  await assert.rejects(submit(second, "e".repeat(64)), /closed/);
  console.log(
    "Quick applications PostgreSQL checks passed: migration, public form, guest submit, retries, phone/job deduplication, shared candidate grouping, account receipt linking, history preservation, guest separation, company authorization, private receipts, and closed jobs.",
  );
} finally {
  await db.close();
}
