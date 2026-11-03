import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN") || "";
const APP_URL = (Deno.env.get("APP_BASE_URL") || "https://sistema-de-inventario-pearl.vercel.app").replace(/\/$/, "");
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const allowedOrigins = new Set([APP_URL, "https://rrnmanager.vercel.app", "http://localhost:3000", "http://127.0.0.1:3000"]);
const headersFor = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : APP_URL,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "600",
  "Vary": "Origin",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer"
});
const json = (body: unknown, status = 200, origin: string | null = null) =>
  new Response(JSON.stringify(body), { status, headers: headersFor(origin) });

async function rateLimit(userId: string, action: string, limit: number, seconds: number) {
  const bytes = new TextEncoder().encode(`billing-api|${action}|${userId}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const key = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
  const { data, error } = await admin.rpc("agent_allow_request", {
    p_rate_key: key, p_limit: limit, p_window_seconds: seconds
  });
  if (error) throw new Error("RATE_LIMIT_UNAVAILABLE");
  if (data !== true) throw new Error("RATE_LIMITED");
}

async function callerFrom(req: Request) {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: profile, error: profileError } = await admin.from("profiles")
    .select("user_id,tenant_id,name,email,role,status").eq("user_id", data.user.id).maybeSingle();
  if (profileError || !profile || profile.status !== "active") return null;
  const { data: platform } = await admin.from("platform_admins").select("user_id")
    .eq("user_id", data.user.id).maybeSingle();
  return { user: data.user, profile, platformAdmin: !!platform?.user_id };
}

async function mpRequest(path: string, method = "GET", body?: unknown, idempotencyKey = crypto.randomUUID()) {
  const response = await fetch(`https://api.mercadopago.com${path}`, {
    method,
    headers: {
      "Authorization": `Bearer ${MP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": idempotencyKey
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("Mercado Pago API error", response.status, data?.message || data?.error || "unknown");
    throw new Error("MERCADO_PAGO_REQUEST_FAILED");
  }
  return data;
}

async function statusFor(caller: NonNullable<Awaited<ReturnType<typeof callerFrom>>>, origin: string | null) {
  const tenantId = caller.profile.tenant_id;
  const [{ data: subscription, error }, { data: plans, error: plansError }, users, assets, { data: entitled }] = await Promise.all([
    admin.from("tenant_subscriptions").select("id,tenant_id,plan_id,status,trial_started_at,trial_ends_at,current_period_start,current_period_end,mp_status,mp_preapproval_id,cancel_at_period_end,billing_plans(id,name,description,monthly_price,max_users,max_assets,features)")
      .eq("tenant_id", tenantId).maybeSingle(),
    admin.from("billing_plans").select("id,name,description,monthly_price,max_users,max_assets,features").eq("active", true).order("sort_order"),
    admin.from("profiles").select("user_id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "active"),
    admin.from("assets").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).is("deleted_at", null),
    admin.rpc("billing_is_entitled", { p_tenant_id: tenantId })
  ]);
  if (error || plansError) throw new Error("BILLING_STATUS_UNAVAILABLE");
  const sub = subscription ? { ...subscription, mp_preapproval_id: undefined } : null;
  const days = sub?.trial_ends_at ? Math.max(0, Math.ceil((new Date(sub.trial_ends_at).getTime() - Date.now()) / 86400000)) : null;
  return json({
    ok: true,
    can_manage: caller.profile.role === "admin" || caller.platformAdmin,
    entitled: entitled === true,
    subscription: sub,
    plans: plans || [],
    usage: { users: users.count || 0, assets: assets.count || 0 },
    trial_days_remaining: days
  }, 200, origin);
}

async function handle(req: Request) {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: headersFor(origin) });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405, origin);
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) return json({ error: "Tipo de conteúdo inválido." }, 415, origin);
  const caller = await callerFrom(req);
  if (!caller) return json({ error: "Sessão inválida ou expirada." }, 401, origin);

  const raw = await req.text();
  if (new TextEncoder().encode(raw).byteLength > 8192) return json({ error: "Requisição muito grande." }, 413, origin);
  let body: any;
  try { body = JSON.parse(raw); } catch { return json({ error: "Requisição inválida." }, 400, origin); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "Requisição inválida." }, 400, origin);

  const action = String(body.action || "");
  if (action === "status") {
    await rateLimit(caller.user.id, "status", 60, 60);
    return await statusFor(caller, origin);
  }
  if (!(caller.profile.role === "admin" || caller.platformAdmin)) {
    return json({ error: "Somente o administrador da empresa pode gerenciar a assinatura." }, 403, origin);
  }
  if (!MP_ACCESS_TOKEN) return json({ error: "A integração de pagamentos ainda não foi configurada pelo administrador da plataforma." }, 503, origin);

  if (action === "checkout") {
    await rateLimit(caller.user.id, "checkout", 5, 3600);
    const planId = String(body.plan_id || "");
    const { data: plan, error: planError } = await admin.from("billing_plans")
      .select("id,name,monthly_price,max_users,max_assets").eq("id", planId).eq("active", true).maybeSingle();
    if (planError || !plan) return json({ error: "Plano não encontrado ou indisponível." }, 404, origin);
    const { data: current, error: currentError } = await admin.from("tenant_subscriptions")
      .select("*").eq("tenant_id", caller.profile.tenant_id).single();
    if (currentError || !current) return json({ error: "Assinatura do workspace não encontrada." }, 404, origin);

    if (current.mp_preapproval_id && current.status === "authorized") {
      const updated = await mpRequest(`/preapproval/${encodeURIComponent(current.mp_preapproval_id)}`, "PUT", {
        auto_recurring: { transaction_amount: Number(plan.monthly_price), currency_id: "BRL" }
      });
      const { error } = await admin.from("tenant_subscriptions").update({
        plan_id: plan.id, mp_status: updated.status || "authorized",
        current_period_end: updated.next_payment_date || current.current_period_end
      }).eq("tenant_id", caller.profile.tenant_id);
      if (error) throw new Error("BILLING_SAVE_FAILED");
      return json({ ok: true, changed: true, message: "Plano atualizado. O novo valor será aplicado pelo Mercado Pago." }, 200, origin);
    }

    if (current.mp_preapproval_id && current.status === "pending") {
      await mpRequest(`/preapproval/${encodeURIComponent(current.mp_preapproval_id)}`, "PUT", { status: "cancelled" }).catch(() => undefined);
    }
    if (current.status === "cancelled" && current.current_period_end && new Date(current.current_period_end) > new Date()) {
      return json({ error: "Sua assinatura atual permanece válida até o fim do período contratado. Aguarde a data de encerramento para contratar outro plano." }, 409, origin);
    }

    const reusePendingCheckout = current.pending_plan_id === plan.id && !current.mp_preapproval_id &&
      ["pending", "checkout_error"].includes(String(current.mp_status || ""));
    const externalReference = reusePendingCheckout ? current.external_reference : crypto.randomUUID();
    const { error: pendingError } = await admin.from("tenant_subscriptions").update({
      pending_plan_id: plan.id, external_reference: externalReference,
      mp_preapproval_id: null, mp_status: "pending", cancel_at_period_end: false
    }).eq("tenant_id", caller.profile.tenant_id);
    if (pendingError) throw new Error("BILLING_SAVE_FAILED");

    try {
      const payerEmail = caller.user.email || caller.profile.email;
      if (!payerEmail) throw new Error("EMAIL_REQUIRED");
      const recurring: Record<string, unknown> = {
        frequency: 1, frequency_type: "months",
        transaction_amount: Number(plan.monthly_price), currency_id: "BRL"
      };
      if (current.status === "trialing" && current.trial_ends_at && new Date(current.trial_ends_at) > new Date()) {
        recurring.start_date = current.trial_ends_at;
      }
      const created = await mpRequest("/preapproval", "POST", {
        reason: `RRN Manager - ${plan.name}`,
        external_reference: externalReference,
        payer_email: payerEmail,
        auto_recurring: recurring,
        back_url: `${APP_URL}/assinatura.html?checkout=return`,
        notification_url: `${SUPABASE_URL}/functions/v1/mercadopago-webhook`
      }, externalReference);
      if (!created.init_point || !created.id) throw new Error("CHECKOUT_URL_MISSING");
      const { error: saveError } = await admin.from("tenant_subscriptions").update({
        mp_preapproval_id: String(created.id), mp_status: String(created.status || "pending")
      }).eq("tenant_id", caller.profile.tenant_id).eq("external_reference", externalReference);
      if (saveError) {
        await mpRequest(`/preapproval/${encodeURIComponent(String(created.id))}`, "PUT", { status: "cancelled" }).catch(() => undefined);
        throw new Error("BILLING_SAVE_FAILED");
      }
      return json({ ok: true, init_point: created.init_point }, 200, origin);
    } catch (error) {
      await admin.from("tenant_subscriptions").update({ mp_status: "checkout_error" })
        .eq("tenant_id", caller.profile.tenant_id).eq("external_reference", externalReference);
      throw error;
    }
  }

  if (action === "cancel") {
    await rateLimit(caller.user.id, "cancel", 3, 3600);
    const { data: current, error } = await admin.from("tenant_subscriptions").select("*")
      .eq("tenant_id", caller.profile.tenant_id).single();
    if (error || !current?.mp_preapproval_id) return json({ error: "Não há assinatura ativa para cancelar." }, 404, origin);
    const cancelled = await mpRequest(`/preapproval/${encodeURIComponent(current.mp_preapproval_id)}`, "PUT", { status: "cancelled" });
    const { error: saveError } = await admin.from("tenant_subscriptions").update({
      status: "cancelled", mp_status: cancelled.status || "cancelled",
      current_period_end: cancelled.next_payment_date || current.current_period_end
    }).eq("tenant_id", caller.profile.tenant_id);
    if (saveError) throw new Error("BILLING_SAVE_FAILED");
    return json({ ok: true, message: "Solicitação de cancelamento enviada ao Mercado Pago." }, 200, origin);
  }

  return json({ error: "Ação inválida." }, 400, origin);
}

Deno.serve(async (req: Request) => {
  try { return await handle(req); }
  catch (error) {
    const origin = req.headers.get("Origin");
    const message = error instanceof Error ? error.message : "UNKNOWN";
    if (message === "RATE_LIMITED") return json({ error: "Muitas solicitações. Aguarde antes de tentar novamente." }, 429, origin);
    if (message === "RATE_LIMIT_UNAVAILABLE") return json({ error: "Proteção temporariamente indisponível. Tente novamente." }, 503, origin);
    if (message === "EMAIL_REQUIRED") return json({ error: "Sua conta não possui e-mail válido para o checkout." }, 400, origin);
    console.error("billing-api:", message);
    return json({ error: "Não foi possível concluir a operação de cobrança. Tente novamente." }, 502, origin);
  }
});
