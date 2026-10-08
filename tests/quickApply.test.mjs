import test from "node:test";
import assert from "node:assert/strict";
import {
  CORE_FIELDS,
  FORM_TEMPLATES,
  validateFields,
  validateAnswers,
  normalizePhone,
  requestTokenForJob,
  enrichQuickCandidate,
} from "../src/lib/quickApply.js";
test("India phone normalization accepts common mobile input and rejects invalid numbers", () => {
  for (const value of ["9876543210", "+91 98765 43210", "919876543210"])
    assert.equal(normalizePhone(value), "+919876543210");
  for (const value of ["123", "1234567890", "+1 9876543210"])
    assert.equal(normalizePhone(value), "");
});
test("templates keep required identity fields and validate", () => {
  for (const fields of Object.values(FORM_TEMPLATES))
    assert.equal(validateFields(fields), fields);
  assert.throws(() =>
    validateFields([{ ...CORE_FIELDS[0], required: false }, CORE_FIELDS[1]]),
  );
  assert.throws(() => validateFields([...CORE_FIELDS, CORE_FIELDS[0]]));
  assert.throws(() =>
    validateFields([
      ...CORE_FIELDS,
      {
        id: "choice",
        label: "Choice",
        type: "select",
        required: true,
        options: ["Yes", "Yes"],
      },
    ]),
  );
});
test("submission validates required, choices, typed values, lengths and strips unknown fields", () => {
  const fields = [
    ...FORM_TEMPLATES.Delivery,
    {
      id: "shifts",
      label: "Shifts",
      type: "checkbox",
      required: true,
      options: ["Day", "Night"],
    },
  ];
  const values = {
    full_name: " Test Applicant ",
    phone: "9876543210",
    location: "Vizag",
    vehicle: "Yes",
    licence: "No",
    shifts: ["Day"],
    student_user_id: "forged",
    status: "hired",
  };
  assert.deepEqual(validateAnswers(fields, values), {
    full_name: "Test Applicant",
    phone: "+919876543210",
    location: "Vizag",
    vehicle: "Yes",
    licence: "No",
    shifts: ["Day"],
  });
  for (const patch of [
    { phone: "123" },
    { full_name: "A" },
    { location: "" },
    { vehicle: "Sometimes" },
    { shifts: ["Forged"] },
    { shifts: [] },
    { full_name: {} },
    { location: "x".repeat(201) },
  ])
    assert.throws(() => validateAnswers(fields, { ...values, ...patch }));
});
test("optional fields can be empty; number and email answers are validated", () => {
  const fields = [
    ...CORE_FIELDS,
    { id: "years", label: "Years", type: "number", required: false },
    { id: "email", label: "Email", type: "email", required: false },
  ];
  const base = { full_name: "Applicant", phone: "9876543210" };
  assert.equal(validateAnswers(fields, base).email, "");
  assert.equal(validateAnswers(fields, { ...base, years: 0 }).years, "0");
  assert.throws(() => validateAnswers(fields, { ...base, years: "-1" }));
  assert.throws(() => validateAnswers(fields, { ...base, email: "bad" }));
});

test("submission receipts survive refreshes and are distinct for different jobs", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key),
    setItem: (key, value) => values.set(key, value),
  };
  const first = requestTokenForJob("delivery", storage);
  assert.equal(requestTokenForJob("delivery", storage), first);
  assert.notEqual(requestTokenForJob("office", storage), first);
  assert.match(
    requestTokenForJob("unavailable", {
      getItem() {
        throw new Error("Blocked");
      },
    }),
    /^[a-f0-9-]{36}$/,
  );
});

test('quick applicants are not assumed to be freshers when experience was not collected', () => {
 const candidate={profileSnapshot:{fullName:'Applicant',isFresher:true}};
 assert.equal(enrichQuickCandidate(candidate,{quickAnswers:{}}).profileSnapshot.isFresher,null);
 assert.equal(enrichQuickCandidate(candidate,{quickAnswers:{experience:'2'}}).profileSnapshot.isFresher,false);
 assert.equal(enrichQuickCandidate(candidate,{quickAnswers:{experience:'0'}}).profileSnapshot.isFresher,true);
 assert.equal(enrichQuickCandidate(candidate,{}),candidate);
});
