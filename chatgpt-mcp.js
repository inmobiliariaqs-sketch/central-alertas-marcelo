const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { z } = require('zod');

module.exports = function conectarChatGPT(app) {
  app.post('/mcp', async (req, res) => {
    const server = new McpServer({ name: 'central-alertas-marcelo', version: '1.0.2' });
    server.registerTool('estado_central', {
      description: 'Comprueba el enlace con Central de Alertas Marcelo sin enviar mensajes.',
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
    }, async () => {
      const diagnostic = {
        transporte: 'conectado',
        proveedor: 'Meta WhatsApp Cloud API',
        destino_fijo: '+34 635453445',
        configuracion: { token_presente: Boolean(process.env.WHATSAPP_TOKEN), numero_emisor_presente: Boolean(process.env.PHONE_NUMBER_ID) },
        envio_verificado: false,
        entrega_verificada: false,
        version: '1.0.2'
      };
      if (diagnostic.configuracion.token_presente && diagnostic.configuracion.numero_emisor_presente) {
        try {
          const response = await fetch(`https://graph.facebook.com/v26.0/${encodeURIComponent(process.env.PHONE_NUMBER_ID)}?fields=id`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` },
            signal: AbortSignal.timeout(5000)
          });
          const result = await response.json();
          diagnostic.consulta_proveedor = { metodo: 'GET_sin_envio', acceso_emisor_verificado: response.ok && Boolean(result.id), http_status: response.status };
          if (!response.ok) {
            diagnostic.consulta_proveedor.codigo = result.error?.code;
            diagnostic.consulta_proveedor.subcodigo = result.error?.error_subcode;
          }
        } catch (_) {
          diagnostic.consulta_proveedor = { metodo: 'GET_sin_envio', acceso_emisor_verificado: false, respuesta_no_disponible: true };
        }
      }
      return { content: [{ type: 'text', text: JSON.stringify(diagnostic) }] };
    });
    server.registerTool('enviar_alerta', {
      title: 'Enviar alerta al WhatsApp de Marcelo',
      description: 'Envía una alerta solicitada por Marcelo a su WhatsApp personal mediante POST /alerta. Úsala para entregar el texto de una alerta o recordatorio autorizado.',
      inputSchema: { mensaje: z.string().min(1).max(4096) },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
    }, async ({ mensaje }) => {
      try {
        const response = await fetch(`http://127.0.0.1:${process.env.PORT || 10000}/alerta`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mensaje }),
          signal: AbortSignal.timeout(15000)
        });
        const result = await response.json();
        return { isError: !response.ok || result.ok !== true, content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (error) {
        return { isError: true, content: [{ type: 'text', text: JSON.stringify({ resultado_incierto: true, reintentar_automaticamente: false, error: 'No se obtuvo respuesta del servicio; no reenviar automáticamente' }) }] };
      }
    });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => { transport.close(); server.close(); });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      if (!res.headersSent) res.status(500).json({ error: 'Error de conexión MCP' });
    }
  });
  app.get('/mcp', (req, res) => res.status(405).set('Allow', 'POST').end());
  app.delete('/mcp', (req, res) => res.status(405).set('Allow', 'POST').end());
};
