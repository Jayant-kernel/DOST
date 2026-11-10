/**
 * Environment access.
 *
 * Deliberately lazy: reading a missing variable throws at the call site, not at
 * import time. A missing Twilio key should break emergency SMS, not stop the
 * whole app from building.
 */

class MissingEnvError extends Error {
  constructor(name: string) {
    super(
      `Missing required environment variable: ${name}. ` +
        `Copy .env.example to .env.local and fill it in.`,
    );
    this.name = "MissingEnvError";
  }
}

/**
 * Read a required variable, throwing a clear error when it is absent.
 *
 * Values are trimmed. Pasting a secret into a hosting dashboard very often
 * carries a trailing newline or space, and a header value containing one makes
 * `fetch` throw `TypeError: Invalid header value` — which surfaces as a
 * network error and sends you hunting for connectivity problems that do not
 * exist.
 */
export function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") throw new MissingEnvError(name);
  return value.trim();
}

/** Read an optional variable. Trimmed, for the same reason as `required`. */
export function optional(name: string, fallback = ""): string {
  const value = process.env[name];
  return value && value.trim() !== "" ? value.trim() : fallback;
}

export const env = {
  // OpenAI Realtime
  get openaiApiKey(): string {
    throw new Error("Gnani-only mode: legacy OpenAI inference is disabled");
  },
  get realtimeModel() {
    return optional("OPENAI_REALTIME_MODEL", "gpt-realtime-2");
  },
  get realtimeVoice() {
    return optional("OPENAI_REALTIME_VOICE", "marin");
  },
  get transcribeModel() {
    return optional("OPENAI_TRANSCRIBE_MODEL", "gpt-4o-transcribe");
  },

  // Supabase
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabaseAnonKey() {
    return required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  },
  get supabaseServiceRoleKey() {
    return required("SUPABASE_SERVICE_ROLE_KEY");
  },

  // Session integrity
  get sessionSigningSecret() {
    return required("SESSION_SIGNING_SECRET");
  },

  // Telephony
  get telephonyProvider() {
    return optional("TELEPHONY_PROVIDER", "console").toLowerCase();
  },

  get appUrl() {
    return optional("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
  },
} as const;

/** True when Supabase is configured. Lets routes degrade instead of crashing. */
export function hasSupabase(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}
