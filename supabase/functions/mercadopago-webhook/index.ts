import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN") || "";
const MP_WEBHOOK_SECRET = Deno.env.get("MP_WEBHOOK_SECRET") || "";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

function safeEqual(a: string, b: string) {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
}

async function validSignature(req: Request, dataId: string) {
  const signature = req.headers.get("x-signature") || "";
  const requestId = req.headers.get("x-request-id") || "";
  const parts = Object.fromEntries(signature.split(",").map(item => {
    const [key, ...rest] = item.trim().split("=");
    return [key, rest.join("=")];
  }));
  const ts = parts.ts || "";
  const received = parts.v1 || "";
  if (!ts || !received || !requestId || !/^\d+$/.test(ts)) return false;
  const timestamp = Number(ts);
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp * 1000) > 24 * 60 * 60 * 1000) return false;
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(MP_WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest));
  const expected = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
  return safeEqual(expected, received.toLowerCase());
}

async function providerGet(path: string) {
  const response = await fetch(`https://api.mercadopago.com${path}`, {
    headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`MP_FETCH_${response.status}`);
  return data;
}

function mapStatus(value: string) {
  const status = String(value || "").toLowerCase();
  if (status === "authorized") return "authorized";
  if (status === "paused") return "paused";
  if (status === "cancelled" || status === "canceled") return "cancelled";
  if (status === "pending") return "pending";
  return "past_due";
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!MP_WEBHOOK_SECRET || !MP_ACCESS_TOKEN) return new Response("Billing webhook not configured", { status: 503 });
  try {
    const url = new URL(req.url);
    const raw = await req.text();
    if (raw.length > 16384) return new Response("Payload too large", { status: 413 });
    let body: any = {};
    try { body = raw ? JSON.parse(raw) : {}; } catch { return new Response("Invalid payload", { status: 400 }); }
    const dataId = String(url.searchParams.get("data.id") || body?.data?.id || "");
    const eventType = String(url.searchParams.get("type") || body?.type || body?.topic || "");
    if (!dataId || !await validSignature(req, dataId)) return new Response("Invalid signature", { status: 401 });

    const eventId = String(body?.id || `${eventType}:${dataId}:${body?.action || "update"}`);
    const { error: eventError } = await admin.from("billing_webhook_events").upsert({
      provider_event_id: eventId, event_type: eventType || "unknown", resource_id: dataId,
      processing_status: "received", error_message: null, processed_at: null
    }, { onConflict: "provider_event_id" });
    if (eventError) throw new Error("WEBHOOK_EVENT_SAVE_FAILED");

    if (eventType === "subscription_preapproval" || eventType === "preapproval") {
      const subscription = await providerGet(`/preapproval/${encodeURIComponent(dataId)}`);
      const externalReference = String(subscription.external_reference || "");
      if (!externalReference) {
        await admin.from("billing_webhook_events").update({ processing_status: "ignored", processed_at: new Date().toISOString() }).eq("provider_event_id", eventId);
        return new Response("Ignored", { status: 200 });
      }
      const { data: local, error } = await admin.from("tenant_subscriptions").select("id,tenant_id,mp_preapproval_id,current_period_end,mp_status,status,pending_plan_id")
        .eq("external_reference", externalReference).maybeSingle();
      if (error) throw error;
      if (!local || (local.mp_preapproval_id && local.mp_preapproval_id !== String(subscription.id))) {
        await admin.from("billing_webhook_events").update({ processing_status: "ignored", processed_at: new Date().toISOString() }).eq("provider_event_id", eventId);
        return new Response("Unknown subscription", { status: 200 });
      }
      const mapped = mapStatus(subscription.status);
      const periodEnd = subscription.next_payment_date || local.current_period_end || null;
      const preservePreviousAccess = mapped === "pending" || (mapped === "cancelled" && local.mp_status === "pending");
      const nextStatus = preservePreviousAccess ? local.status : mapped;
      const update: Record<string, unknown> = {
        mp_preapproval_id: String(subscription.id), mp_status: String(subscription.status || ""),
        status: nextStatus, current_period_end: periodEnd
      };
      if (mapped === "authorized") {
        if (local.pending_plan_id) update.plan_id = local.pending_plan_id;
        update.pending_plan_id = null;
        update.current_period_start = subscription.date_created || new Date().toISOString();
      } else if (mapped === "cancelled") {
        update.pending_plan_id = null;
      }
      const { error: updateError } = await admin.from("tenant_subscriptions").update(update).eq("id", local.id);
      if (updateError) throw updateError;
    } else if (eventType === "subscription_authorized_payment") {
      const payment = await providerGet(`/authorized_payments/${encodeURIComponent(dataId)}`);
      const preapprovalId = String(payment.preapproval_id || payment.subscription_id || "");
      if (preapprovalId) {
        const { data: local, error } = await admin.from("tenant_subscriptions").select("id,status,current_period_end,pending_plan_id")
          .eq("mp_preapproval_id", preapprovalId).maybeSingle();
        if (error) throw error;
        if (local) {
          const paymentStatus = String(payment.status || "").toLowerCase();
          const nextStatus = ["approved", "processed", "authorized"].includes(paymentStatus) ? "authorized" :
            ["rejected", "cancelled", "refunded"].includes(paymentStatus) ? "past_due" : local.status;
          const update: Record<string, unknown> = {
            status: nextStatus, mp_status: paymentStatus,
            current_period_start: payment.date_created || new Date().toISOString(),
            current_period_end: payment.date_of_expiration || local.current_period_end
          };
          if (nextStatus === "authorized" && local.pending_plan_id) {
            update.plan_id = local.pending_plan_id;
            update.pending_plan_id = null;
          }
          const { error: updateError } = await admin.from("tenant_subscriptions").update(update).eq("id", local.id);
          if (updateError) throw updateError;
        }
      }
    } else {
      await admin.from("billing_webhook_events").update({ processing_status: "ignored", processed_at: new Date().toISOString() }).eq("provider_event_id", eventId);
      return new Response("Event ignored", { status: 200 });
    }

    await admin.from("billing_webhook_events").update({ processing_status: "processed", processed_at: new Date().toISOString() }).eq("provider_event_id", eventId);
    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("mercadopago-webhook:", error instanceof Error ? error.message : "unknown");
    return new Response("Webhook processing failed", { status: 500 });
  }
});
