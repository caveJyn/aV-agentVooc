import { elizaLogger, type IAgentRuntime } from "@elizaos/core";
import {
    EmailOutgoingProvider,
    EmailIncomingProvider,
    type OutgoingConfig,
    type GmailConfig,
    type IncomingConfig,
    type SmtpConfig,
} from "../types/config";
import { z } from "zod";

// Define the schema for other providers
const GmailConfigSchema = z.object({
    provider: z.literal(EmailOutgoingProvider.GMAIL),
    service: z.string().optional(),
    user: z.string().min(1, "User is required"),
    pass: z.string().min(1, "Password is required"),
});

const SmtpConfigSchema = z.object({
    provider: z.literal(EmailOutgoingProvider.SMTP),
    host: z.string(),
    port: z.number(),
    secure: z.boolean(),
    user: z.string().min(1, "User is required"),
    pass: z.string().min(1, "Password is required"),
});

const ImapConfigSchema = z.object({
    provider: z.literal(EmailIncomingProvider.IMAP),
    host: z.string(),
    port: z.number(),
    user: z.string().min(1, "User is required"),
    pass: z.string().min(1, "Password is required"),
});

// Function to validate EmailConfig
export function validateOutgoingEmailConfig(
    runtime: IAgentRuntime
): OutgoingConfig {
    elizaLogger.debug("[EMAIL-PLUGIN] Verifying outgoing email service settings");
    try {
        let config: GmailConfig | SmtpConfig;
        let result;
        const provider: string | undefined =
            runtime.getSetting("EMAIL_OUTGOING_SERVICE") ||
            process.env.EMAIL_PROVIDER;

        if (!provider) {
            elizaLogger.warn("[EMAIL-PLUGIN] Email outgoing service not set");
            return null;
        }

        elizaLogger.debug("[EMAIL-PLUGIN] Validating outgoing provider", { provider });

        switch (provider?.toLowerCase()) {
            case EmailOutgoingProvider.GMAIL:
                config = {
                    provider: EmailOutgoingProvider.GMAIL,
                    service: "Gmail",
                    user:
                        runtime.getSetting("EMAIL_OUTGOING_USER") ||
                        process.env.EMAIL_OUTGOING_USER,
                    pass:
                        runtime.getSetting("EMAIL_OUTGOING_PASS") ||
                        process.env.EMAIL_OUTGOING_PASS,
                } as GmailConfig;
                elizaLogger.debug("[EMAIL-PLUGIN] Gmail config loaded", {
                    user: config.user,
                    pass: "[REDACTED]",
                });
                result = GmailConfigSchema.safeParse(config);
                break;
            case EmailOutgoingProvider.SMTP:
                config = {
                    provider: EmailOutgoingProvider.SMTP,
                    host:
                        runtime.getSetting("EMAIL_OUTGOING_HOST") ||
                        process.env.EMAIL_OUTGOING_HOST,
                    port:
                        Number(
                            runtime.getSetting("EMAIL_OUTGOING_PORT") ||
                                process.env.EMAIL_OUTGOING_PORT
                        ) || 465,
                    user:
                        runtime.getSetting("EMAIL_OUTGOING_USER") ||
                        process.env.EMAIL_USER,
                    pass:
                        runtime.getSetting("EMAIL_OUTGOING_PASS") ||
                        process.env.EMAIL_PASS,
                } as SmtpConfig;

                config.secure = config.port === 465;
                elizaLogger.debug("[EMAIL-PLUGIN] SMTP config loaded", {
                    host: config.host,
                    port: config.port,
                    secure: config.secure,
                    user: config.user,
                    pass: "[REDACTED]",
                });
                result = SmtpConfigSchema.safeParse(config);
                break;
            default:
                elizaLogger.error("[EMAIL-PLUGIN] Email provider not supported", {
                    provider,
                });
                return null;
        }

        if (!result.success) {
            elizaLogger.error("[EMAIL-PLUGIN] Outgoing email config validation failed", {
                errors: result.error.errors.map((e) => ({
                    path: e.path.join("."),
                    message: e.message,
                })),
            });
            throw new Error(
                `Email configuration validation failed\n${result.error.errors.map((e) => e.message).join("\n")}`
            );
        }

        elizaLogger.debug("[EMAIL-PLUGIN] Outgoing email config validated successfully", {
            provider: config.provider,
        });
        return config;
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errorMessages = error.errors
                .map((err) => `${err.path.join(".")}: ${err.message}`)
                .join("\n");
            elizaLogger.error("[EMAIL-PLUGIN] Outgoing email config validation error", {
                error: errorMessages,
            });
            throw new Error(`Email configuration validation failed:\n${errorMessages}`);
        }
        elizaLogger.error("[EMAIL-PLUGIN] Unexpected error in outgoing config validation", {
            error: error.message,
            stack: error.stack,
        });
        throw error;
    }
}

export function validateIncomingEmailConfig(
    runtime: IAgentRuntime
): IncomingConfig {
    elizaLogger.debug("[EMAIL-PLUGIN] Verifying incoming email service settings");
    const provider =
        runtime.getSetting("EMAIL_INCOMING_SERVICE") ||
        process.env.EMAIL_INCOMING_SERVICE;
    if (!provider) {
        elizaLogger.warn("[EMAIL-PLUGIN] Email incoming service not set");
        return null;
    }

    elizaLogger.debug("[EMAIL-PLUGIN] Validating incoming provider", { provider });

    const config = {
        provider: EmailIncomingProvider.IMAP,
        host:
            runtime.getSetting("EMAIL_INCOMING_HOST") ||
            process.env.EMAIL_INCOMING_HOST,
        port:
            Number(
                runtime.getSetting("EMAIL_INCOMING_PORT") ||
                    process.env.EMAIL_INCOMING_PORT
            ) || 993,
        user:
            runtime.getSetting("EMAIL_INCOMING_USER") ||
            process.env.EMAIL_INCOMING_USER,
        pass:
            runtime.getSetting("EMAIL_INCOMING_PASS") ||
            process.env.EMAIL_INCOMING_PASS,
    } as IncomingConfig;

    elizaLogger.debug("[EMAIL-PLUGIN] IMAP config loaded", {
        host: config.host,
        port: config.port,
        user: config.user,
        pass: "[REDACTED]",
    });
    elizaLogger.debug('[EMAIL-PLUGIN] Incoming config values:', {
  user: config.user || 'undefined',
  pass: config.pass ? '[REDACTED]' : 'undefined',
  settingsSecrets: runtime.character.settings?.secrets ? Object.keys(runtime.character.settings.secrets).reduce((acc, key) => ({
    ...acc,
    [key]: '[REDACTED]',
  }), {}) : 'undefined',
});

    let result = ImapConfigSchema.safeParse(config);
    if (!result.success) {
        elizaLogger.error("[EMAIL-PLUGIN] Incoming email config validation failed", {
            errors: result.error.errors.map((e) => ({
                path: e.path.join("."),
                message: e.message,
            })),
        });
        throw new Error(
            `Email configuration validation failed\n${result.error.errors.map((e) => e.message).join("\n")}`
        );
    }

    elizaLogger.debug("[EMAIL-PLUGIN] Incoming email config validated successfully", {
        provider: config.provider,
    });
    return config;
}