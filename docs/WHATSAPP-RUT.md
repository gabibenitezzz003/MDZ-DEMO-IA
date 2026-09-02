# RUT por WhatsApp (cierre de demo)

La demo web **ya no carga el registro RUT en el formulario**.
Cuando alguien pide registrarse / “quiero el RUT”, se abre WhatsApp con un agente especializado (OpenWA + n8n). Para la presentación, la respuesta principal es un flujo determinista por texto: no depende de la cuota de Gemini y conserva el paso de cada chat.

## 1. Configurar el número en la demo

En `.env.local` y en el server `.env.production`:

```bash
WHATSAPP_RUT_NUMBER=549261XXXXXXX
WHATSAPP_RUT_TEXT=Hola, quiero registrarme en el RUT de Mendoza. Me derivaron desde la demo de Agricultura.
```

- Solo dígitos, con código de país (Argentina = `54…`). No se compila en el bundle del cliente: la UI obtiene la URL desde `/api/agent/whatsapp-rut`.
- Reiniciá `npm run dev` tras cambiar `.env.local`.
- Verificar: `curl http://127.0.0.1:3000/api/agent/whatsapp-rut` → `"configured": true`.

## 2. Importar el workflow OpenWA

Archivo: `n8n/openwa-rut-agente.json`

1. Importar en n8n.
2. Conectar credenciales: Redis, OpenWA (`X-API-Key`), Gemini y ElevenLabs. Redis conserva el estado RUT por `chatId` durante 7 días y también deduplica por `messageId`.
3. En OpenWA, webhook `message.received` → `http://n8n:5678/webhook/pruebas` (desde Docker; en el host es `http://127.0.0.1:5678/webhook/pruebas`).
4. OpenWA `.env`: `MEDIA_CONVERSION_ENABLED=true`, `MEDIA_DOWNLOAD_ENABLED=true`.
5. Gemini solo mejora el tono de una respuesta ya validada. Si falla, el selector híbrido conserva la respuesta determinista. El texto siempre se envía; la nota de voz es adicional y puede fallar sin cortar el flujo.

### Si n8n “frena” en Normalizar entrada

OpenWA envía varios tipos de evento. El nodo solo procesa `message.received` de texto, audio, imagen o documento. `status.received` y `test` terminan con `return []`: es el filtro esperado, no un error.

No es un fallo: es filtro anti-ruido. **Probá mandando un WhatsApp real** al `5492613417054`.

El nodo **Respuesta RUT segura** pide los datos de a uno, valida dígito verificador del CUIT, mail, teléfono y transiciones, y permite `corregir`, `reiniciar`, `confirmar` y `cancelar`.

Las fotos y documentos se asocian al estado como `received-demo`. La respuesta confirma recepción, pero nunca afirma validez oficial. Si falta el medio descargado, el flujo sigue por texto.

## 3. Red host y Docker

- Desarrollo en host: `SPEACHES_URL=http://127.0.0.1:8771` y `N8N_WEBHOOK_URL=http://127.0.0.1:5678/...`.
- App dentro de Docker en Linux: usar `SPEACHES_DOCKER_URL` y `N8N_DOCKER_WEBHOOK_URL` con `http://host.docker.internal:...`; Compose agrega `host-gateway`.
- Entre contenedores de la misma red se puede usar el nombre de servicio (`http://n8n:5678`).

## 4. Flujo de usuario en la demo

1. Dice “quiero el RUT” / toca **Quiero el RUT por WhatsApp**.
2. La demo navega a la sección RUT y abre `wa.me/...` en otra pestaña.
3. El agente de WhatsApp continúa el registro por texto. Las notas de voz entrantes se transcriben cuando ElevenLabs está disponible.
4. La demo web sigue disponible para cultivos, mapas, clima, etc.

Excepciones:

- “qué es el RUT” → explicación en la página (sin WhatsApp).
- “wizard demo” → abre el wizard visual en `/rut` (sin registro real).

## 5. Checklist del día de la demo

- [ ] Número WA cargado en el servidor (no requiere variable `NEXT_PUBLIC`)
- [ ] WhatsApp abre con mensaje precargado
- [ ] Agente responde por texto sin depender de Gemini
- [ ] Pedido de foto/documento funciona
- [ ] Ruido ambiente no dispara el mic (usar Push-to-talk si el salón es muy ruidoso)
