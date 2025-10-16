import { supabase } from "@/integrations/supabase/client";

type DispatchEvent = "approved" | "rejected";

export interface ContactInfo {
  name?: string;
  phone?: string;
  email?: string;
}

export interface DispatchPayload {
  processId: string;
  userId: string;
  currentStage: string;
  nextStage?: string; // for approved
  event: DispatchEvent;
  reason?: string; // for rejected
  contact: ContactInfo;
}

const EVOLUTION_API_URL = (import.meta.env.VITE_EVOLUTION_API_URL || "").replace(/\/$/, "");
const EVOLUTION_API_TOKEN = import.meta.env.VITE_EVOLUTION_API_TOKEN || "";
const EVOLUTION_INSTANCE = import.meta.env.VITE_EVOLUTION_INSTANCE || "default";
const SENDGRID_API_KEY = import.meta.env.VITE_SENDGRID_API_KEY || "";
const SENDGRID_FROM_EMAIL = import.meta.env.VITE_SENDGRID_FROM_EMAIL || "";

function sanitizePhone(phone?: string): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, "");
  // Ensure country code 55; if missing and number looks like regional, prefix 55
  if (digits.startsWith("55")) return digits;
  return `55${digits}`;
}

function buildApprovedText(stage: string, nextStage: string, processId: string) {
  const link = `${window.location.origin}/processo/${processId}`;
  return `✅ Sua etapa *${capitalize(stage)}* foi aprovada!\nO processo agora segue para *${capitalize(nextStage)}*.\n\nAcompanhe: ${link}\n\n🧯 CBM-PE - Sistema de Vistorias`;
}

function buildRejectedText(stage: string, reason: string, processId: string) {
  const link = `${window.location.origin}/processo/${processId}`;
  return `⚠️ Sua etapa *${capitalize(stage)}* não foi aprovada.\nMotivo: ${reason}.\n\nPor favor, acesse o portal e corrija/reenvie os documentos.\nLink: ${link}\n\n🧯 CBM-PE - Sistema de Vistorias`;
}

function buildEmailSubject(stage: string) {
  return `[CBM-PE] Atualização do seu Processo de ${capitalize(stage)}`;
}

function buildEmailHtmlApproved(name: string, stage: string, nextStage: string, processId: string) {
  const link = `${window.location.origin}/processo/${processId}`;
  return `
    <div style="font-family: Arial, sans-serif;">
      <h2>🧯 CBM-PE - Sistema de Vistorias</h2>
      <p>Olá, <strong>${escapeHtml(name)}</strong>,</p>
      <p>Sua etapa <strong>${escapeHtml(capitalize(stage))}</strong> foi <strong>aprovada</strong>.</p>
      <p>O processo agora segue para <strong>${escapeHtml(capitalize(nextStage))}</strong>.</p>
      <p>Para acompanhar, acesse: <a href="${link}">${link}</a></p>
      <br/>
      <p>🔥 Corpo de Bombeiros Militar de Pernambuco</p>
      <p>Sistema de Gestão de Vistorias e Processos (SGVP)</p>
    </div>
  `;
}

function buildEmailHtmlRejected(name: string, stage: string, reason: string, processId: string) {
  const link = `${window.location.origin}/processo/${processId}`;
  return `
    <div style="font-family: Arial, sans-serif;">
      <h2>🧯 CBM-PE - Sistema de Vistorias</h2>
      <p>Olá, <strong>${escapeHtml(name)}</strong>,</p>
      <p>Sua etapa <strong>${escapeHtml(capitalize(stage))}</strong> <strong>não foi aprovada</strong>.</p>
      <p>Motivo: ${escapeHtml(reason)}</p>
      <p>Por favor, acesse o portal e corrija/reenvie os documentos solicitados.</p>
      <p>Link: <a href="${link}">${link}</a></p>
      <br/>
      <p>🔥 Corpo de Bombeiros Militar de Pernambuco</p>
      <p>Sistema de Gestão de Vistorias e Processos (SGVP)</p>
    </div>
  `;
}

export async function sendWhatsappMessage(number: string, text: string) {
  if (!EVOLUTION_API_TOKEN || !EVOLUTION_API_URL) {
    return { status: "skipped", reason: "missing_config" };
  }
  const isManagerEndpoint = /\bmanager\b/.test(EVOLUTION_API_URL);
  const url = isManagerEndpoint
    ? EVOLUTION_API_URL
    : `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (isManagerEndpoint) {
    headers["Authorization"] = `Bearer ${EVOLUTION_API_TOKEN}`;
  } else {
    headers["apikey"] = EVOLUTION_API_TOKEN;
  }

  const payload = isManagerEndpoint
    ? { number, text }
    : { number, text };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errText = await res.text();
      return { status: "failed", error: errText };
    }
    return { status: "success" };
  } catch (e: any) {
    return { status: "failed", error: e?.message || String(e) };
  }
}

export async function sendEmailNotification(to: string, subject: string, html: string) {
  if (!SENDGRID_API_KEY || !SENDGRID_FROM_EMAIL) {
    return { status: "skipped", reason: "missing_sendgrid_config" };
  }
  try {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: SENDGRID_FROM_EMAIL, name: "CBM-PE" },
        subject,
        content: [{ type: "text/html", value: html }],
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      return { status: "failed", error: errText };
    }
    return { status: "success" };
  } catch (e: any) {
    return { status: "failed", error: e?.message || String(e) };
  }
}

export async function logNotification(payload: {
  processId: string;
  userId: string;
  stage: string;
  event: DispatchEvent;
  message: string;
  whatsapp_status?: string | null;
  email_status?: string | null;
  error?: string | null;
}) {
  try {
    await supabase.from("notifications").insert({
      process_id: payload.processId,
      user_id: payload.userId,
      stage: payload.stage,
      status: payload.event,
      message: payload.message,
      whatsapp_status: payload.whatsapp_status || null,
      email_status: payload.email_status || null,
      error: payload.error || null,
    } as any);
  } catch (e) {
    // swallow errors to avoid blocking admin flow
    console.warn("Falha ao registrar notificação:", e);
  }
}

export async function dispatchStatusChange(dp: DispatchPayload) {
  const phone = sanitizePhone(dp.contact.phone);
  const email = dp.contact.email;
  const name = dp.contact.name || "Usuário";

  let text = "";
  let subject = "";
  let html = "";
  if (dp.event === "approved" && dp.nextStage) {
    text = buildApprovedText(dp.currentStage, dp.nextStage, dp.processId);
    subject = buildEmailSubject(dp.currentStage);
    html = buildEmailHtmlApproved(name, dp.currentStage, dp.nextStage, dp.processId);
  } else if (dp.event === "rejected") {
    const reason = dp.reason || "Pendências a corrigir";
    text = buildRejectedText(dp.currentStage, reason, dp.processId);
    subject = buildEmailSubject(dp.currentStage);
    html = buildEmailHtmlRejected(name, dp.currentStage, reason, dp.processId);
  }

  // Send WhatsApp
  let wStatus: string | null = null;
  let eStatus: string | null = null;
  let error: string | null = null;

  if (phone) {
    const w = await sendWhatsappMessage(phone, text);
    wStatus = w.status;
    if (w.status === "failed") error = (w as any).error || null;
  } else {
    wStatus = "skipped";
  }

  if (email) {
    const e = await sendEmailNotification(email, subject, html);
    eStatus = e.status;
    if (e.status === "failed") error = [error, (e as any).error].filter(Boolean).join(" | ") || null;
  } else {
    eStatus = "skipped";
  }

  await logNotification({
    processId: dp.processId,
    userId: dp.userId,
    stage: dp.currentStage,
    event: dp.event,
    message: text,
    whatsapp_status: wStatus,
    email_status: eStatus,
    error,
  });
}

function capitalize(s: string) {
  return (s || "").charAt(0).toUpperCase() + (s || "").slice(1);
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}