// Server-only email sender using Resend REST API.
// Never import from client code.

const RESEND_API = "https://api.resend.com/emails";
const DEFAULT_FROM = "Nica-POS <onboarding@resend.dev>";

export type SendEmailArgs = {
  to: string;
  subject: string;
  html: string;
  from?: string;
};

export async function sendEmail({ to, subject, html, from }: SendEmailArgs) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[email] RESEND_API_KEY missing; skipping send to", to);
    return { skipped: true as const };
  }
  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: from ?? DEFAULT_FROM,
        to: [to],
        subject,
        html,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("[email] Resend error", res.status, body);
      return { error: `${res.status} ${body}` };
    }
    return { ok: true as const };
  } catch (e: any) {
    console.error("[email] send failed", e?.message);
    return { error: e?.message ?? "send failed" };
  }
}

// ------ Templates ------

const wrap = (title: string, body: string) => `
<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f6f7f9;padding:24px;color:#111">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;border:1px solid #e5e7eb">
  <h2 style="margin:0 0 12px 0;color:#111">${title}</h2>
  ${body}
  <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb"/>
  <p style="font-size:12px;color:#6b7280;margin:0">Nica-POS · Punto de venta para tu negocio</p>
</div></body></html>`;

export const emailTemplates = {
  trialReceived: (name: string) => ({
    subject: "Recibimos tu solicitud de prueba",
    html: wrap(
      "¡Solicitud recibida!",
      `<p>Hola ${escape(name)},</p>
       <p>Recibimos tu solicitud para la <b>prueba gratuita de 7 días</b> en Nica-POS.</p>
       <p>Nuestro equipo la está revisando y te notificaremos por este mismo correo cuando sea aprobada (normalmente en menos de 24 horas).</p>
       <p>Mientras tanto, tu cuenta permanecerá en estado <b>"En revisión"</b> al iniciar sesión.</p>`,
    ),
  }),
  trialApproved: (name: string, days: number) => ({
    subject: "¡Tu prueba fue aprobada!",
    html: wrap(
      "¡Prueba aprobada! 🎉",
      `<p>Hola ${escape(name)},</p>
       <p>Tu prueba gratuita de <b>${days} días</b> ya está activa.</p>
       <p>Inicia sesión con tu correo y contraseña habituales para empezar a usar tu tienda.</p>
       <p style="margin-top:20px"><a href="https://nicapos.lovable.app/auth" style="background:#0f172a;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Ingresar a mi cuenta</a></p>`,
    ),
  }),
  trialRejected: (name: string, reason: string) => ({
    subject: "Sobre tu solicitud de prueba",
    html: wrap(
      "Solicitud no aprobada",
      `<p>Hola ${escape(name)},</p>
       <p>Lamentamos informarte que tu solicitud de prueba gratuita no fue aprobada.</p>
       <p><b>Motivo:</b> ${escape(reason)}</p>
       <p>Si consideras que es un error o quieres adquirir un plan directamente, puedes escribirnos respondiendo a este correo.</p>`,
    ),
  }),
  paymentApproved: (name: string, planName: string) => ({
    subject: "Tu plan está activo",
    html: wrap(
      "¡Pago confirmado!",
      `<p>Hola ${escape(name)},</p>
       <p>Confirmamos tu pago del plan <b>${escape(planName)}</b>. Tu tienda ya está activa.</p>
       <p style="margin-top:20px"><a href="https://nicapos.lovable.app/dashboard" style="background:#0f172a;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Ir al panel</a></p>`,
    ),
  }),
  paymentRejected: (name: string, reason: string) => ({
    subject: "No pudimos verificar tu pago",
    html: wrap(
      "Pago no aprobado",
      `<p>Hola ${escape(name)},</p>
       <p>No pudimos verificar el comprobante enviado.</p>
       <p><b>Motivo:</b> ${escape(reason)}</p>
       <p>Por favor vuelve a intentarlo desde tu cuenta seleccionando el plan.</p>`,
    ),
  }),
};

function escape(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
