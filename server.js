const express = require("express");

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
  try {
    const mensaje = req.body.mensaje;

    if (!mensaje) {
      return res.status(400).json({
        ok: false,
        error: "Falta el campo mensaje"
      });
    }

    if (!WHATSAPP_TOKEN) {
      return res.status(500).json({
        ok: false,
        error: "Falta WHATSAPP_TOKEN"
      });
    }

    if (!PHONE_NUMBER_ID) {
      return res.status(500).json({
        ok: false,
        error: "Falta PHONE_NUMBER_ID"
      });
    }

    const response = await fetch(
      `https://graph.facebook.com/v26.0/${PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
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
      console.error("Error de WhatsApp:", data);

      return res.status(response.status).json({
        ok: false,
        error: data
      });
    }

    console.log("ALERTA ENVIADA A MARCELO:", mensaje);

    return res.status(200).json({
      ok: true,
      enviado_a: MARCELO_WHATSAPP,
      whatsapp: data
    });

  } catch (error) {
    console.error("Error enviando alerta:", error);

    return res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Central de Alertas activa en puerto ${PORT}`);
});
