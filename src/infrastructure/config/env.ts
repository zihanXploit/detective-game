import { z } from "zod";

const schema = z
  .object({
    DATABASE_URL: z.string().min(1),
    SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
    /**
     * The public origin this is served from, such as https://example.com.
     * Browsers attach cookies to cross-site WebSocket handshakes, so the socket
     * server compares this against the handshake's Origin header.
     */
    APP_ORIGIN: z.string().url().optional(),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  })
  .superRefine((env, ctx) => {
    // In development the socket server falls back to comparing against the Host
    // header, which is fine on a laptop and not good enough in front of a proxy.
    if (env.NODE_ENV === "production" && !env.APP_ORIGIN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["APP_ORIGIN"],
        message: "APP_ORIGIN must be set in production, so cross-site socket connections can be refused",
      });
    }
  });

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/** Read lazily so importing a module never crashes the build; fails loudly on first real use. */
export function getEnv(): Env {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const details = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      throw new Error(`Invalid environment configuration: ${details}`);
    }
    cached = parsed.data;
  }
  return cached;
}
