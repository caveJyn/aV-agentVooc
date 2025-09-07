import pino, { type LogFn } from "pino";
import pretty from "pino-pretty";
import { parseBooleanFromText } from "./parsing.ts";

const customLevels: Record<string, number> = {
    fatal: 60,
    error: 50,
    warn: 40,
    info: 30,
    log: 29,
    progress: 28,
    success: 27,
    debug: 20,
    trace: 10,
};

const raw = parseBooleanFromText(process?.env?.LOG_JSON_FORMAT) || false;

const createStream = () => {
    if (raw) {
        return undefined;
    }
    return pretty({
        colorize: true,
        translateTime: "yyyy-mm-dd HH:MM:ss",
        ignore: "pid,hostname",
    });
};

const defaultLevel = process?.env?.DEFAULT_LOG_LEVEL || "info";

// Create the base pino logger without custom hooks
const basePinoLogger = pino({
    level: defaultLevel,
    customLevels,
}, createStream());

// Create a flexible wrapper that handles both parameter orders
const createFlexibleLogger = (baseLogger: any) => {
    const flexibleLog = (level: string) => (...args: any[]) => {
        if (args.length === 0) {
            baseLogger[level]({}, "");
            return;
        }

        const [arg1, arg2, ...rest] = args;
        
        if (typeof arg1 === "object" && arg1 !== null) {
            // Format: object, message, ...rest
            const messageParts = [arg2, ...rest].map((arg) =>
                typeof arg === "string" ? arg : JSON.stringify(arg)
            );
            const message = messageParts.filter(Boolean).join(" ");
            baseLogger[level](arg1, message);
        } else if (typeof arg1 === "string") {
            if (typeof arg2 === "object" && arg2 !== null && rest.length === 0) {
                // Legacy format: string, object - swap them
                baseLogger[level](arg2, arg1);
            } else {
                // Format: string, ...rest
                const context: Record<string, any> = {};
                const allArgs = [arg2, ...rest];
                
                // Extract objects for context
                const objects = allArgs.filter((arg) => typeof arg === "object" && arg !== null);
                objects.forEach(obj => Object.assign(context, obj));
                
                // Extract strings for message
                const strings = allArgs.filter((arg) => typeof arg === "string");
                const message = strings.length > 0 ? `${arg1} ${strings.join(" ")}` : arg1;
                
                baseLogger[level](context, message);
            }
        } else {
            // Fallback - convert everything to string
            const message = args.map((arg) =>
                typeof arg === "string" ? arg : JSON.stringify(arg)
            ).join(" ");
            baseLogger[level]({}, message);
        }
    };

    return {
        fatal: flexibleLog('fatal'),
        error: flexibleLog('error'),
        warn: flexibleLog('warn'),
        info: flexibleLog('info'),
        log: flexibleLog('log'),
        progress: flexibleLog('progress'),
        success: flexibleLog('success'),
        debug: flexibleLog('debug'),
        trace: flexibleLog('trace'),
        // Preserve other pino methods
        child: baseLogger.child.bind(baseLogger),
        level: baseLogger.level,
        setLevel: baseLogger.setLevel?.bind(baseLogger),
    };
};

export const elizaLogger = createFlexibleLogger(basePinoLogger);
export default elizaLogger;