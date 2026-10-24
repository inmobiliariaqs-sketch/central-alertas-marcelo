const express = require("express");
const { randomUUID } = require("node:crypto");

const app = express();
app.use(express.json());
require('./chatgpt-mcp')(app);

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "central_alertas_marcelo_2026";

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// Tu WhatsApp fijo
const MARCELO_WHATSAPP = "34635453445";

// Comprobación del servidor
app.get("/", (req, res) => {
  res.status(200).send("Central de Alertas Marcelo funcionando");
});

// Mantiene funcionando la verificación de Meta que ya configuramos
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verificado correctamente");
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

// Mantener recepción del webhook sin hacer nada con ella
app.post("/webhook", (req, res) => {
  console.log("Evento de Meta recibido");
  return res.sendStatus(200);
});

// =====================================================
// ENVÍO DE ALERTAS A MARCELO
// =====================================================

app.post("/alerta", async (req, res) => {
  const requestId = randomUUID();
  console.log("alert_request", JSON.stringify({ request_id: requestId }));
  try {
    const mensaje = req.body.mensaje;

    if (typeof mensaje !== "string" || !mensaje.trim() || mensaje.length > 4096) {
      return res.status(400).json({
        ok: false,
        request_id: requestId,
        error: "El campo mensaje debe ser texto entre 1 y 4096 caracteres"
      });
    }

    if (!WHATSAPP_TOKEN) {
      return res.status(500).json({
        ok: false,
        request_id: requestId,
        error: "Falta WHATSAPP_TOKEN"
      });
    }

    if (!PHONE_NUMBER_ID) {
      return res.status(500).json({
        ok: false,
        request_id: requestId,
        error: "Falta PHONE_NUMBER_ID"
      });
    }

    const response = await fetch(
      `https://graph.facebook.com/v26.0/${PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        signal: AbortSignal.timeout(12000),
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: MARCELO_WHATSAPP,
          type: "text",
          text: {
            preview_url: false,
            body: mensaje
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("whatsapp_rejected", JSON.stringify({ request_id: requestId, http_status: response.status, code: data.error?.code, subcode: data.error?.error_subcode, trace_id: data.error?.fbtrace_id }));

      return res.status(response.status).json({
        ok: false,
        request_id: requestId,
        error: { message: "WhatsApp rechazó la solicitud", code: data.error?.code, subcode: data.error?.error_subcode, trace_id: data.error?.fbtrace_id }
      });
    }

    console.log("whatsapp_accepted", JSON.stringify({ request_id: requestId, message_id: data.messages?.[0]?.id }));

    return res.status(200).json({
      ok: true,
      request_id: requestId,
      estado: "aceptado_por_proveedor_no_confirma_entrega",
      enviado_a: MARCELO_WHATSAPP,
      whatsapp: { messages: (data.messages || []).map(item => ({ id: item.id })) }
    });

  } catch (error) {
    console.error("whatsapp_outcome_unknown", JSON.stringify({ request_id: requestId, error_name: error.name }));

    return res.status(500).json({
      ok: false,
      request_id: requestId,
      resultado_incierto: true,
      reintentar_automaticamente: false,
      error: "No se pudo verificar la respuesta de WhatsApp; no reenviar automáticamente"
    });
  }
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Central de Alertas activa en puerto ${PORT}`);
});
