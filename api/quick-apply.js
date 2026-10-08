import { createHmac, createHash } from "node:crypto";
import {
  createServiceClient,
  getSupabaseEnv,
  getBearerToken,
} from "./_lib/supabaseAuth.js";
import { sendJson } from "./_lib/http.js";
import { validateAnswers } from "../src/lib/quickApply.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Method not allowed." });
  }
  const client = createServiceClient();
  if (!client)
    return sendJson(res, 503, {
      error:
        "Applications are temporarily unavailable. Please try again later.",
    });
  try {
    let body = req.body;
    if (!body) {
      const chunks = [];
      let length = 0;
      for await (const chunk of req) {
        length += Buffer.byteLength(chunk);
        if (length > 32000)
          return sendJson(res, 413, { error: "Application is too large." });
        chunks.push(Buffer.from(chunk));
      }
      body = JSON.parse(Buffer.concat(chunks).toString());
    } else if (typeof body === "string") body = JSON.parse(body);
    if (Buffer.byteLength(JSON.stringify(body)) > 32000)
      return sendJson(res, 413, { error: "Application is too large." });
    if (body.website)
      return sendJson(res, 200, { accepted: true, claimable: false });
    if (
      body.consent !== true ||
      !/^[a-f0-9-]{36}$/i.test(body.requestToken || "") ||
      !/^[a-f0-9-]{36}$/i.test(body.jobId || "")
    )
      throw new Error("Please complete the form and consent.");
    const { data: job, error } = await client.rpc("get_quick_job", {
      p_slug: body.jobId,
    });
    if (error || !job || !job.is_open)
      throw new Error("This job is not accepting applications.");
    if (body.formId !== job.form_id)
      throw new Error("The form has changed. Refresh the page and try again.");
    const answers = validateAnswers(job.fields, body.answers);
    let userId = null;
    const token = getBearerToken(req);
    if (token) {
      const {
        data: { user },
      } = await client.auth.getUser(token);
      userId = user?.id || null;
    }
    // Vercel supplies this header; do not trust an arbitrary forwarded-for chain.
    const ip = String(
      req.headers["x-vercel-forwarded-for"] ||
        req.socket?.remoteAddress ||
        "unknown",
    ).split(",")[0];
    const ipKey = createHmac("sha256", getSupabaseEnv().serviceRole)
      .update(ip)
      .digest("hex");
    const tokenHash = createHash("sha256")
      .update(body.requestToken)
      .digest("hex");
    const { data, error: submissionError } = await client.rpc(
      "submit_quick_application",
      {
        p_job_id: job.id,
        p_form_id: job.form_id,
        p_answers: answers,
        p_token_hash: tokenHash,
        p_source: String(body.source || "direct").slice(0, 80),
        p_ip_key: ipKey,
        p_user_id: userId,
      },
    );
    if (submissionError) {
      const safe = /closed|changed|Too many attempts/.test(
        submissionError.message,
      )
        ? submissionError.message
        : "Could not save your application. Please try again.";
      return sendJson(res, /Too many/.test(safe) ? 429 : 400, { error: safe });
    }
    return sendJson(res, 200, data);
  } catch (error) {
    return sendJson(res, 400, {
      error:
        error instanceof SyntaxError ? "Invalid application." : error.message,
    });
  }
}
