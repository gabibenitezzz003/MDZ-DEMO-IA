import { gunzipSync, gzipSync } from "zlib";

export type OdkCollectSettings = {
  general: {
    server_url: string;
    username?: string;
    password?: string;
    protocol?: "odk_default";
  };
  admin?: Record<string, unknown>;
  project: {
    name: string;
    icon?: string;
    color?: string;
  };
};

/** Servidor público de ODK: Collect crea el proyecto y se puede abrir. */
export const ODK_DEMO_SERVER_URL = "https://demo.getodk.org";

export function buildOdkCollectSettings(): OdkCollectSettings {
  return {
    general: {
      server_url:
        process.env.ODK_COLLECT_SERVER_URL?.trim() || ODK_DEMO_SERVER_URL,
      username: process.env.ODK_COLLECT_USERNAME?.trim() || "",
      password: process.env.ODK_COLLECT_PASSWORD?.trim() || "",
      protocol: "odk_default",
    },
    admin: {},
    project: {
      name:
        process.env.ODK_COLLECT_PROJECT_NAME?.trim() || "Agricultura Mendoza",
      icon: "A",
      color: "#1d4ed8",
    },
  };
}

export const DEFAULT_ODK_SETTINGS = buildOdkCollectSettings();

/**
 * Collect / Central: JSON → gzip → Base64 (sin saltos de línea).
 * El protocolo válido es `odk_default`, no odk_central.
 */
export function encodeOdkCollectPayload(
  settings: OdkCollectSettings = DEFAULT_ODK_SETTINGS
): string {
  const json = JSON.stringify({
    general: settings.general,
    admin: settings.admin ?? {},
    project: settings.project,
  });
  return gzipSync(Buffer.from(json, "utf8")).toString("base64");
}

export function decodeOdkCollectPayload(payload: string): OdkCollectSettings {
  const json = gunzipSync(Buffer.from(payload, "base64")).toString("utf8");
  return JSON.parse(json) as OdkCollectSettings;
}
