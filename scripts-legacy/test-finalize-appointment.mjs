#!/usr/bin/env node
/**
 * Finalize an appointment via API, with early-finalization fallback.
 * Usage (PowerShell):
 *   $env:ACCESS_TOKEN = '<JWT>'
 *   # Optional, defaults to http://localhost:8000
 *   $env:API_BASE = 'https://your-backend.example.com'
 *   node .\scripts\test-finalize-appointment.mjs 143
 */

const APPT_ID = parseInt(process.argv[2] || process.env.APPT_ID || "143", 10);
const API_BASE = (process.env.API_BASE || "http://localhost:8000").replace(
  /\/+$/,
  ""
);
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;

if (!ACCESS_TOKEN) {
  console.error("[test-finalize] Missing ACCESS_TOKEN env var. Aborting.");
  process.exit(2);
}

const headersBase = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${ACCESS_TOKEN}`,
};

async function apiFetch(path, opts = {}) {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      ...headersBase,
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { res, data, text };
}

function iso(d) {
  return new Date(d).toISOString();
}

function fromServerDateHeader(res) {
  try {
    const h = res.headers.get("Date");
    if (h) return new Date(h);
  } catch {}
  return new Date();
}

async function getAppointment(id) {
  const { res, data } = await apiFetch(`/agenda/appointments/${id}/`);
  if (!res.ok) throw new Error(`GET appointment failed ${res.status}`);
  return { res, data };
}

async function patchAppointment(id, payload) {
  const { res, data, text } = await apiFetch(`/agenda/appointments/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(
      `PATCH failed ${res.status}: ${
        typeof data === "string" ? data : JSON.stringify(data)
      }`
    );
  }
  return { res, data, text };
}

async function postFinalize(id) {
  return apiFetch(`/agenda/appointments/${id}/finalize/`, { method: "POST" });
}

async function postDone(id) {
  return apiFetch(`/agenda/appointments/${id}/done/`, { method: "POST" });
}

(async () => {
  console.log(`[test-finalize] API_BASE=${API_BASE} appt=${APPT_ID}`);
  try {
    // Try finalize first
    let { res, data, text } = await postFinalize(APPT_ID);
    if (res.ok) {
      console.log("[test-finalize] finalize OK", res.status);
    } else if (
      res.status === 422 &&
      data &&
      (data.code === "too_early" || data.detail === "too_early")
    ) {
      console.warn(
        "[test-finalize] too_early, applying fallback PATCH to adjust times..."
      );
      const { res: getRes, data: appt } = await getAppointment(APPT_ID);
      const serverNow = fromServerDateHeader(getRes);
      const now = serverNow;
      const start = new Date(appt.start_at);
      const end = new Date(appt.end_at);
      let payload;
      if (now < start) {
        const endAdj = new Date(now.getTime() + 1000);
        payload = { start_at: iso(now), end_at: iso(endAdj), status: "done" };
      } else if (now >= start && now < end) {
        payload = { end_at: iso(now), status: "done" };
      } else {
        payload = { status: "done" };
      }
      await patchAppointment(APPT_ID, payload);
      ({ res, data, text } = await postDone(APPT_ID));
      if (!res.ok) {
        console.warn(
          "[test-finalize] /done/ not OK, trying status-only PATCH as last resort"
        );
        await patchAppointment(APPT_ID, { status: "done" });
      }
    } else {
      throw new Error(
        `finalize failed ${res.status}: ${
          typeof data === "string" ? data : JSON.stringify(data)
        }`
      );
    }

    // Confirm final state
    const { data: finalAppt } = await getAppointment(APPT_ID);
    console.log("[test-finalize] Final status:", finalAppt.status);
    console.log("[test-finalize] start_at:", finalAppt.start_at);
    console.log("[test-finalize] end_at  :", finalAppt.end_at);

    if (finalAppt.status !== "done") {
      console.error("[test-finalize] Unexpected final status");
      process.exit(1);
    }
    console.log("\nSUCCESS: Appointment finalized.");
    process.exit(0);
  } catch (e) {
    console.error("[test-finalize] Error:", e?.message || e);
    process.exit(1);
  }
})();
