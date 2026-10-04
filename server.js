const express = require("express");

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// Comprobación de que la Central está funcionando
app.get("/", (req, res) => {
  res.status(200).send("Central de Alertas Marcelo funcionando");
});

// Verificación del webhook de Meta
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

// Recepción de eventos de WhatsApp
app.post("/webhook", (req, res) => {
  console.log("Evento recibido de WhatsApp:");
  console.log(JSON.stringify(req.body, null, 2));

  res.sendStatus(200);
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Central de Alertas activa en puerto ${PORT}`);
});
