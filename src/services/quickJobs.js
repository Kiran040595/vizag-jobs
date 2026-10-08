import { supabase, supabasePublic } from "../lib/supabaseClient";
import { validateFields } from "../lib/quickApply";
export async function getQuickJob(slug) {
  const { data, error } = await (supabasePublic || supabase).rpc(
    "get_quick_job",
    { p_slug: slug },
  );
  if (error) throw new Error(error.message);
  return data;
}
export async function saveQuickJob(job, fields, id = null) {
  validateFields(fields);
  const { data, error } = await supabase.rpc("save_quick_job", {
    p_job: job,
    p_fields: fields,
    p_job_id: id,
  });
  if (error) throw new Error(error.message);
  return data;
}
const RECEIPTS_KEY = "vizagjobs.quick.receipts";
export function storeReceipt(token) {
  try {
    const records = JSON.parse(localStorage.getItem(RECEIPTS_KEY) || "[]");
    localStorage.setItem(
      RECEIPTS_KEY,
      JSON.stringify([...new Set([...records, token])].slice(-50)),
    );
  } catch {
    /* Application was saved even when storage is unavailable. */
  }
}
export async function claimQuickApplications() {
  let tokens;
  try {
    tokens = JSON.parse(localStorage.getItem(RECEIPTS_KEY) || "[]");
  } catch {
    return 0;
  }
  if (!Array.isArray(tokens) || !tokens.length) return 0;
  const hashes = await Promise.all(
    tokens.map(async (token) =>
      Array.from(
        new Uint8Array(
          await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(token),
          ),
        ),
      )
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
    ),
  );
  const { data, error } = await supabase.rpc("claim_quick_applications", {
    p_token_hashes: hashes,
  });
  if (error) throw new Error(error.message);
  localStorage.removeItem(RECEIPTS_KEY);
  sessionStorage.removeItem("vizagjobs.quick.registration");
  return data;
}
