# ODK Collect y el código QR

## ¿Para qué es?

**ODK Collect** es una app de Android para cargar formularios en el campo (relevamientos, encuestas, datos productivos).  
El **código QR** del portal **no es un link web**: es la configuración del proyecto. Al escanearlo con Collect, el celular queda apuntando al servidor (URL, proyecto y ajustes), sin tipear nada a mano.

## Qué contiene el QR

El QR de ODK Collect lleva un JSON comprimido (gzip + Base64) con, entre otros:

| Campo | Para qué sirve |
| --- | --- |
| `general.server_url` | URL del servidor ODK Central / Aggregate |
| `general.username` | Usuario de la app (si aplica) |
| `general.protocol` | Protocolo (`odk_central`, `odk_aggregate`) |
| `project.name` | Cómo aparece el proyecto en Collect |

**No es** una URL para abrir en el navegador. Si lo escaneás con la cámara del teléfono (fuera de Collect), no “entra” al trámite web.

## Cómo se usa (pasos de la app)

1. Instalá **ODK Collect** desde Google Play (Android).
2. Abrí la app.
3. Pulsá **Agregar proyecto** (o el ícono de proyecto → Agregar proyecto).
4. Elegí **Escanear código QR**.
5. Escaneá el QR de esta sección.
6. Después podés **Descargar formulario** y completar en campo.

## Relación con esta demo

- En la DEMO el QR (`/odk/odk-collect.png`) usa el formato de Collect/Central: JSON → gzip → Base64, protocolo `odk_default`.
- Por defecto apunta a `https://demo.getodk.org` para que al escanear se cree el proyecto. Se puede cambiar con `ODK_COLLECT_SERVER_URL`.
- Si el usuario pregunta “qué es el QR” / “ODK” / “cómo cargo el formulario del celular”, explicá estos pasos y marcá la sección `odk-collect`.

## Frases típicas del productor

- “¿El QR para qué es?”
- “Cómo uso ODK”
- “Agregar proyecto”
- “Formulario del celular / relevamiento en campo”
