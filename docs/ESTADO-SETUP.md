# Estado del setup Dograh

## Listo

1. **Agente:** `Asistente Agricultura Mendoza - inbound`  
   https://app.dograh.com/workflow/11137  
   Publicado **v3** (español mendocino + saludo en español)

2. **Prompts v3:**
   - Global Node: voseo mendocino, regla dura de no hablar inglés
   - Start Call: greeting en español + prompt en español
   - Main Agenda: sigue en español (navegación + RUT)
   - Textos para copiar: `docs/DOGRAH-PROMPTS.md`

3. **Navegación sincronizada con voz (API DEMO):**
   - `navigate` / `describe` → scrollea, resalta y **devuelve `spoken`** para que el agente narre
   - `scroll` (`up` / `down` / `top` / `bottom`)
   - `go_home` / `go_back`
   - RUT: `open_rut`, `rut_set_step`, `show_checklist`

4. **Credencial:** `Demo Agricultura Secret` (`x-demo-secret`)

5. **Tools HTTP actuales (4) en Main Agenda:**
   - `navigate_section` (ahora responde con `spoken`)
   - `open_rut_wizard`
   - `set_rut_step`
   - `show_doc_checklist`

6. **Widget embebido:** Voice + Floating, botón `Hablar con el asistente`

## ElevenLabs GABI B (casi listo)

En Models → BYOK → Voice quedó cargado (sin guardar org-wide para no romper el LLM de Dograh):

- Provider: ElevenLabs
- Voice ID: `xDZJO6bbSnscJEAbhpRF` (GABI B)
- Model: `eleven_multilingual_v2`
- Speed: `1.02`

**Guardar solo Voice** (override del agente) o, si pasás la org a BYOK, también tenés que poner API key de LLM. No dejes BYOK a medias.

## Pendiente

1. Click **Save Configuration** en Voice si querés activar GABI B ya.
2. Crear tools `scroll_page`, `go_home`, `go_back` y adjuntarlas a Main Agenda.
3. Actualizar URL de las tools si cambia el tunnel.
4. Subir KB Files (`content/knowledge/*.md`).
5. **Rotar la API key de ElevenLabs** (quedó expuesta en el chat).

## Tunnel

`localtunnel` suele cambiar de URL y a veces da 408.  
Mantener: `npm run dev` + un tunnel vivo. Header `Bypass-Tunnel-Reminder: 1` en cada tool.
