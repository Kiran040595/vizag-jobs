export const FIELD_TYPES = [
  "text",
  "textarea",
  "number",
  "select",
  "radio",
  "checkbox",
  "email",
];
export const CORE_FIELDS = [
  { id: "full_name", label: "Full name", type: "text", required: true },
  { id: "phone", label: "Mobile number", type: "text", required: true },
];
export const FIELD_LIBRARY = [
  { id: "location", label: "Where do you live?", type: "text", required: true },
  {
    id: "education",
    label: "Highest education",
    type: "select",
    options: ["10th", "12th", "Diploma", "Graduate", "Postgraduate", "Other"],
    required: false,
  },
  {
    id: "experience",
    label: "Experience in years",
    type: "number",
    required: false,
  },
  {
    id: "vehicle",
    label: "Do you have a two-wheeler?",
    type: "radio",
    options: ["Yes", "No"],
    required: true,
  },
  {
    id: "licence",
    label: "Do you have a driving licence?",
    type: "radio",
    options: ["Yes", "No"],
    required: true,
  },
  { id: "email", label: "Email address", type: "email", required: false },
];
export const FORM_TEMPLATES = {
  Basic: [...CORE_FIELDS, FIELD_LIBRARY[0]],
  Delivery: [
    ...CORE_FIELDS,
    FIELD_LIBRARY[0],
    FIELD_LIBRARY[3],
    FIELD_LIBRARY[4],
  ],
  Office: [
    ...CORE_FIELDS,
    FIELD_LIBRARY[0],
    FIELD_LIBRARY[1],
    FIELD_LIBRARY[2],
  ],
};
export function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return /^91[6-9]\d{9}$/.test(digits)
    ? `+${digits}`
    : /^[6-9]\d{9}$/.test(digits)
      ? `+91${digits}`
      : "";
}
export function validateFields(fields) {
  if (!Array.isArray(fields) || fields.length < 2 || fields.length > 20)
    throw new Error("Choose between 2 and 20 fields.");
  const ids = new Set();
  for (const field of fields) {
    if (!/^[a-z][a-z0-9_]{0,49}$/.test(field.id) || ids.has(field.id))
      throw new Error("Each field needs a unique ID.");
    ids.add(field.id);
    if (
      !FIELD_TYPES.includes(field.type) ||
      !String(field.label || "").trim() ||
      field.label.length > 120 ||
      typeof field.required !== "boolean"
    )
      throw new Error("Check the field label, type and required setting.");
    if (["select", "radio", "checkbox"].includes(field.type)) {
      if (
        !Array.isArray(field.options) ||
        !field.options.length ||
        field.options.length > 20 ||
        field.options.some(
          (o) => typeof o !== "string" || !o.trim() || o.length > 80,
        ) ||
        new Set(field.options).size !== field.options.length
      )
        throw new Error("Choice fields need 1–20 unique options.");
    }
  }
  for (const core of CORE_FIELDS) {
    const field = fields.find((f) => f.id === core.id);
    if (!field?.required || field.type !== "text")
      throw new Error("Name and phone must stay required text fields.");
  }
  return fields;
}
export function validateAnswers(fields, input) {
  validateFields(fields);
  if (!input || Array.isArray(input) || typeof input !== "object")
    throw new Error("Check your answers.");
  const answers = {};
  for (const field of fields) {
    const raw = input[field.id];
    if (field.type === "checkbox") {
      const value = raw == null ? [] : raw;
      if (
        !Array.isArray(value) ||
        value.length > field.options.length ||
        value.some((v) => !field.options.includes(v))
      )
        throw new Error(`Check ${field.label}.`);
      answers[field.id] = [...new Set(value)];
      if (field.required && !value.length)
        throw new Error(`${field.label} is required.`);
      continue;
    }
    if (raw != null && typeof raw !== "string" && typeof raw !== "number")
      throw new Error(`Check ${field.label}.`);
    const value = String(raw ?? "").trim();
    if (field.required && !value)
      throw new Error(`${field.label} is required.`);
    if (value.length > (field.type === "textarea" ? 2000 : 200))
      throw new Error(`${field.label} is too long.`);
    if (
      value &&
      ["select", "radio"].includes(field.type) &&
      !field.options.includes(value)
    )
      throw new Error(`Check ${field.label}.`);
    if (
      value &&
      field.type === "number" &&
      (!/^\d+(\.\d+)?$/.test(value) || Number(value) > 100000000)
    )
      throw new Error(`Check ${field.label}.`);
    if (
      value &&
      field.type === "email" &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    )
      throw new Error("Check your email address.");
    answers[field.id] = value;
  }
  answers.phone = normalizePhone(answers.phone);
  if (!answers.phone) throw new Error("Enter a valid Indian mobile number.");
  if (answers.full_name.length < 2) throw new Error("Enter your full name.");
  return answers;
}
export function answerText(fields, answers) {
  return fields
    .map(
      (f) =>
        `${f.label}: ${Array.isArray(answers[f.id]) ? answers[f.id].join(", ") : answers[f.id] || "—"}`,
    )
    .join("\n");
}

// Keep the same receipt across refreshes and network retries for this job.
export function requestTokenForJob(jobId, storage = globalThis.sessionStorage) {
  const key = `vizagjobs.quick.request.${jobId}`;
  try {
    const existing = storage?.getItem(key);
    if (
      /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
        existing || "",
      )
    )
      return existing;
    const token = crypto.randomUUID();
    storage?.setItem(key, token);
    return token;
  } catch {
    return crypto.randomUUID();
  }
}

export function enrichQuickCandidate(candidate, snapshot) {
  if (!snapshot?.quickAnswers) return candidate;
  const experience = snapshot.quickAnswers.experience;
  const isFresher = experience == null || experience === '' ? null : Number(experience) === 0;
  return { ...candidate, profileSnapshot: { ...candidate.profileSnapshot, ...snapshot, isFresher } };
}
