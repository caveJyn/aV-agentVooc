// packages/plugin-email/src/clients/emailClient.ts
import { ImapFlow, type FetchMessageObject } from "imapflow";
import { EventEmitter } from "node:events";
import { elizaLogger, type IAgentRuntime, stringToUuid, validateUuid } from "@elizaos/core";
import nodemailer, { type Transporter } from "nodemailer";
import { validateIncomingEmailConfig, validateOutgoingEmailConfig } from "../config/email";
import { type IncomingConfig, type OutgoingConfig, type SendEmailOptions, type EmailResponse, type ExtendedEmailContent, EmailOutgoingProvider, type SmtpConfig } from "../types";
import { setupEmailListener } from "../utils/emailListener";
import { isUserConnected, resolveUserIdFromCreatedBy } from "@elizaos-plugins/plugin-shared-email-sanity";
import { sanityClient } from "@elizaos-plugins/plugin-shared-email-sanity";

function debounce<T extends (...args: any[]) => void>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

interface EmailHealthMetrics {
  lastSuccessfulFetch: number;
  failedAttempts: number;
  isHealthy: boolean;
}

class IncomingEmailManager extends EventEmitter {
  private imapClient: ImapFlow | null = null;
  private config: IncomingConfig;
  private userId: string;
  private runtime: IAgentRuntime;
  private isDisabled = false;
  private isConnecting = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private readonly baseReconnectDelay = 5000;
  private isIdleActive = false;
  private intervals: NodeJS.Timeout[] = [];
  private lastSuccessfulFetch = 0;
  private lastConnectionStatus: boolean | null = null;

  constructor(config: IncomingConfig, userId: string, runtime: IAgentRuntime) {
    super();
    this.config = {
      ...config,
      initialFetchLimit: config.initialFetchLimit || 25,
      initialFetchSince: config.initialFetchSince || new Date(Date.now() - 24 * 60 * 60 * 1000),
    };
    this.userId = userId;
    this.runtime = runtime;
    elizaLogger.debug(`[IMAP:${this.config.user}] Initializing IncomingEmailManager`, {
      userId,
      host: config.host,
      port: config.port,
      initialFetchLimit: this.config.initialFetchLimit,
      initialFetchSince: this.config.initialFetchSince,
    });
    this.initializeImapClient();
  }

  private initializeImapClient() {
    this.imapClient = new ImapFlow({
      host: this.config.host,
      port: this.config.port,
      secure: true,
      auth: { user: this.config.user, pass: this.config.pass },
      connectionTimeout: 40000,
      greetingTimeout: 30000,
      socketTimeout: 60000,
      logger: {
        debug: (msg) => elizaLogger.debug(`[IMAP:${this.config.user}] Debug`, msg),
        info: (msg) => {}, // elizaLogger.debug(`[IMAP:${this.config.user}] Info`, msg),
        warn: (msg) => elizaLogger.warn(`[IMAP:${this.config.user}] Warn`, msg),
        error: (msg) => elizaLogger.error(`[IMAP:${this.config.user}] Error`, msg),
      },
    });

    this.imapClient.on("error", (err) => this.handleImapError(err));
    this.imapClient.on("close", () => {
      elizaLogger.debug(`[IMAP:${this.config.user}] Connection closed`, { userId: this.userId });
      this.handleImapError(new Error("Connection closed"));
    });
    elizaLogger.debug(`[IMAP:${this.config.user}] ImapFlow client initialized`, { userId: this.userId });
  }

  async start() {
    elizaLogger.debug(`[IMAP:${this.config.user}] Entering start method`, { userId: this.userId, timestamp: new Date().toISOString() });
    if (this.isDisabled) {
      elizaLogger.debug(`[IMAP:${this.config.user}] IncomingEmailManager is disabled, checking user connection`, { userId: this.userId });
      const isConnected = await isUserConnected(this.userId).catch(() => true);
      if (!isConnected) {
        elizaLogger.debug(`[IMAP:${this.config.user}] User is offline/disconnected, skipping start`, { userId: this.userId });
        this.lastConnectionStatus = false;
        await this.stop();
        return;
      }
      elizaLogger.debug(`[IMAP:${this.config.user}] User is now online, enabling`, { userId: this.userId });
      this.isDisabled = false;
    }
    this.lastConnectionStatus = true;
    elizaLogger.debug(`[IMAP:${this.config.user}] Starting IncomingEmailManager`, { userId: this.userId });
    await this.connectAndFetch();
  }

  async reset() {
    if (this.isConnecting) {
      elizaLogger.debug(`[IMAP:${this.config.user}] Reset called but connection attempt in progress, skipping`, { userId: this.userId });
      return;
    }
    elizaLogger.debug(`[IMAP:${this.config.user}] Resetting IncomingEmailManager`, { userId: this.userId });
    this.isDisabled = false;
    this.reconnectAttempts = 0;
    this.isIdleActive = false;
    this.intervals.forEach(clearTimeout);
    this.intervals = [];
    await this.stop();
    await this.start();
  }

  private async connectAndFetch() {
    if (this.isConnecting) {
      elizaLogger.debug(`[IMAP:${this.config.user}] Connection attempt already in progress, skipping`, { userId: this.userId });
      return;
    }
    this.isConnecting = true;
    try {
      const isConnected = await isUserConnected(this.userId).catch(() => true);
      if (!isConnected) {
        elizaLogger.debug(`[IMAP:${this.config.user}] User is offline/disconnected, skipping reconnection`, { userId: this.userId });
        this.isDisabled = true;
        this.lastConnectionStatus = false;
        await this.stop();
        return;
      }
      this.lastConnectionStatus = true;
      if (!this.imapClient) {
        this.initializeImapClient();
      }
      elizaLogger.debug(`[IMAP:${this.config.user}] Attempting to connect`, { userId: this.userId });
      await this.imapClient!.connect();
      elizaLogger.debug(`[IMAP:${this.config.user}] ImapFlow connected successfully`, { userId: this.userId });
      await this.imapClient!.mailboxOpen("INBOX");
      elizaLogger.debug(`[IMAP:${this.config.user}] Access to Inbox granted`, { userId: this.userId });
      await this.initialFetch();
      this.setupIdle();
      this.reconnectAttempts = 0;
    } catch (error: any) {
      elizaLogger.error(`[IMAP:${this.config.user}] Connection failed`, { userId: this.userId, error: error.message, stack: error.stack });
      this.handleImapError(error);
    } finally {
      this.isConnecting = false;
    }
  }

  private async initialFetch() {
    if (!this.imapClient || this.isDisabled) {
      elizaLogger.debug(`[IMAP:${this.config.user}] Skipping initial fetch: ${!this.imapClient ? "No IMAP client" : "Disabled"}`, { userId: this.userId });
      return;
    }
    elizaLogger.debug(`[IMAP:${this.config.user}] Starting initial fetch`, {
      userId: this.userId,
      since: this.config.initialFetchSince,
      limit: this.config.initialFetchLimit,
    });
    try {
      const searchCriteria: any = { seen: false };
      if (this.config.initialFetchSince) {
        searchCriteria.since = this.config.initialFetchSince;
      }
      const messages = await this.imapClient.search(searchCriteria, { uid: false });
      if (!Array.isArray(messages)) {
        elizaLogger.debug(`[IMAP:${this.config.user}] No unseen emails found in initial fetch`, { userId: this.userId });
        return;
      }
      const recentMessages = messages.slice(-this.config.initialFetchLimit!);
      const chunkSize = 10;
      for (let i = 0; i < recentMessages.length; i += chunkSize) {
        const chunk = recentMessages.slice(i, i + chunkSize);
        await Promise.allSettled(chunk.map(async (seq) => {
          elizaLogger.debug(`[IMAP:${this.config.user}] Fetching email with sequence ${seq}`, { userId: this.userId });
          const message = await this.imapClient!.fetchOne(seq, { source: true, envelope: true, headers: true });
          if (message) {
            const mail = this.parseMessage(message);
            elizaLogger.debug(`[IMAP:${this.config.user}] Emitting email from initial fetch`, {
              userId: this.userId,
              emailUUID: mail.emailUUID,
              originalEmailId: mail.messageId,
              subject: mail.subject,
            });
            this.emit("mail", mail);
            try {
              await this.imapClient!.messageFlagsAdd(seq, ["\\Seen"], { uid: false });
              elizaLogger.debug(`[IMAP:${this.config.user}] Marked email as read in initial fetch`, {
                userId: this.userId,
                sequence: seq,
                emailUUID: mail.emailUUID,
                originalEmailId: mail.messageId,
              });
              this.lastSuccessfulFetch = Date.now();
            } catch (flagError: any) {
              elizaLogger.error(`[IMAP:${this.config.user}] Failed to mark email as read in initial fetch`, {
                userId: this.userId,
                sequence: seq,
                emailUUID: mail.emailUUID,
                originalEmailId: mail.messageId,
                error: flagError.message,
              });
            }
          } else {
            elizaLogger.warn(`[IMAP:${this.config.user}] No message found for sequence ${seq} in initial fetch`, { userId: this.userId });
          }
        }));
      }
    } catch (error: any) {
      elizaLogger.error(`[IMAP:${this.config.user}] Initial fetch failed`, { userId: this.userId, error: error.message });
      throw error;
    }
  }

  private setupIdle() {
    if (!this.imapClient || this.isIdleActive || this.isDisabled) {
      elizaLogger.debug(`[IMAP:${this.config.user}] Skipping IDLE setup: ${!this.imapClient ? "No IMAP client" : this.isDisabled ? "Disabled" : "IDLE already active"}`, { userId: this.userId });
      return;
    }
    elizaLogger.debug(`[IMAP:${this.config.user}] Setting up IMAP IDLE`, { userId: this.userId });
    this.isIdleActive = true;
    this.imapClient.idle().then(() => {
      elizaLogger.debug(`[IMAP:${this.config.user}] IMAP IDLE started`, { userId: this.userId });
      this.imapClient!.on("exists", async (data) => {
        const isConnected = await isUserConnected(this.userId).catch(() => true);
        if (!isConnected) {
          elizaLogger.debug(`[IMAP:${this.config.user}] User is offline/disconnected, stopping IDLE`, { userId: this.userId });
          await this.stop();
          return;
        }
        elizaLogger.debug(`[IMAP:${this.config.user}] Exists event triggered`, {
          userId: this.userId,
          sequence: data.count,
          newMessages: data.count - (data.prevCount || 0),
        });
        const seq = data.count;
        try {
          elizaLogger.debug(`[IMAP:${this.config.user}] Fetching new email with sequence ${seq}`, { userId: this.userId });
          const message = await this.imapClient!.fetchOne(seq, { source: true, envelope: true, headers: true });
          if (message) {
            const mail = this.parseMessage(message);
            elizaLogger.debug(`[IMAP:${this.config.user}] Emitting new email`, {
              userId: this.userId,
              emailUUID: mail.emailUUID,
              originalEmailId: mail.messageId,
              subject: mail.subject,
            });
            this.emit("mail", mail);
            try {
              await this.imapClient!.messageFlagsAdd(seq, ["\\Seen"], { uid: false });
              elizaLogger.debug(`[IMAP:${this.config.user}] Marked new email as read`, {
                userId: this.userId,
                sequence: seq,
                emailUUID: mail.emailUUID,
                originalEmailId: mail.messageId,
              });
              this.lastSuccessfulFetch = Date.now();
            } catch (flagError: any) {
              elizaLogger.error(`[IMAP:${this.config.user}] Failed to mark new email as read`, {
                userId: this.userId,
                sequence: seq,
                emailUUID: mail.emailUUID,
                originalEmailId: mail.messageId,
                error: flagError.message,
              });
            }
          } else {
            elizaLogger.warn(`[IMAP:${this.config.user}] No message found for sequence ${seq}`, { userId: this.userId });
          }
        } catch (fetchError: any) {
          elizaLogger.error(`[IMAP:${this.config.user}] Failed to fetch email for sequence ${seq}`, {
            userId: this.userId,
            error: fetchError.message,
          });
        }
      });
    }).catch((err) => {
      elizaLogger.error(`[IMAP:${this.config.user}] IMAP IDLE setup failed`, { userId: this.userId, error: err.message });
      this.isIdleActive = false;
      this.handleImapError(err);
    });
  }

  private parseMessage(message: FetchMessageObject): ExtendedEmailContent {
    const headersStr = message.headers?.toString() || "";
    const headersObj: Record<string, string> = {};
    headersStr.split(/\r?\n/).forEach((line) => {
      const idx = line.indexOf(":");
      if (idx > -1) {
        const key = line.slice(0, idx).trim().toLowerCase();
        const value = line.slice(idx + 1).trim();
        headersObj[key] = value;
      }
    });
    const references = headersObj["references"] ? headersObj["references"].split(/\s+/).filter(ref => ref.trim()) : [];
    let threadId = headersObj["x-gm-thread-id"];
    if (!threadId && headersObj["references"]) {
      threadId = references[0]?.replace(/^<|>$/g, "") || stringToUuid(message.envelope.messageId || `generated-${Date.now()}`);
    }
    if (!threadId && message.envelope.messageId) {
      threadId = stringToUuid(message.envelope.messageId);
    }
    const emailUUID = stringToUuid(message.envelope.messageId || `${Date.now()}${Math.random()}`);
    if (!validateUuid(emailUUID)) {
      elizaLogger.error(`[IMAP:${this.config.user}] Invalid email UUID generated`, {
        emailUUID,
        originalEmailId: message.envelope.messageId,
      });
      throw new Error(`Invalid email UUID generated for messageId: ${message.envelope.messageId}`);
    }
    const mail: ExtendedEmailContent = {
      from: Array.isArray(message.envelope.from)
        ? message.envelope.from.map((addr: any) => ({ address: addr.address, name: addr.name || "" }))
        : [],
      subject: message.envelope.subject || "",
      date: message.envelope.date,
      text: message.source?.toString() || "",
      html: "",
      headers: message.headers,
      uid: message.uid ?? 0,
      flags: Array.isArray(message.flags) ? message.flags : (message.flags ? Array.from(message.flags) : []),
      messageId: message.envelope.messageId,
      emailUUID,
      references,
      threadId,
    };
    elizaLogger.debug(`[IMAP:${this.config.user}] Parsed email`, {
      userId: this.userId,
      emailUUID: mail.emailUUID,
      originalEmailId: mail.messageId,
      subject: mail.subject,
      threadId: mail.threadId,
    });
    return mail;
  }

  private async handleImapError(err: any) {
    if (this.isDisabled) {
      elizaLogger.debug(`[IMAP:${this.config.user}] Ignoring error due to disabled state`, { userId: this.userId, error: err.message });
      return;
    }
    const isConnected = await isUserConnected(this.userId).catch(() => true);
    if (!isConnected) {
      elizaLogger.debug(`[IMAP:${this.config.user}] User is offline/disconnected, disabling`, { userId: this.userId });
      await this.stop();
      return;
    }
    elizaLogger.error(`[IMAP:${this.config.user}] Connection error`, {
      userId: this.userId,
      error: err.message,
      code: err.code,
      reconnectAttempts: this.reconnectAttempts,
    });
    await this.stop();
    if (err.message.includes("Can not re-use ImapFlow instance")) {
      elizaLogger.warn(`[IMAP:${this.config.user}] ImapFlow reuse error, reinitializing`, { userId: this.userId });
      this.imapClient = null;
      this.isIdleActive = false;
    }
    if (err.code === "EAUTH") {
      elizaLogger.error(`[IMAP:${this.config.user}] Authentication failed, disabling`, { userId: this.userId });
      this.isDisabled = true;
      return;
    }
    if (["ETIMEDOUT", "ENOTFOUND", "ECONNREFUSED"].includes(err.code) || err.message === "Connection closed") {
      elizaLogger.warn(`[IMAP:${this.config.user}] Network-related error, attempting reconnection`, {
        userId: this.userId,
        error: err.message,
        code: err.code,
      });
      this.imapClient = null; // Ensure client is cleared
    this.isIdleActive = false;
    this.initializeImapClient(); // Reinitialize client
    }
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts);
      this.reconnectAttempts++;
      elizaLogger.debug(`[IMAP:${this.config.user}] Scheduling reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`, {
        userId: this.userId,
        delayMs: delay,
      });
      this.intervals.push(setTimeout(() => this.connectAndFetch(), delay));
    } else {
      this.isDisabled = true;
      elizaLogger.error(`[IMAP:${this.config.user}] Max reconnection attempts reached, disabling`, { userId: this.userId });
    }
  }

  async stop() {
    this.isDisabled = true;
    this.isIdleActive = false;
    this.intervals.forEach(clearTimeout);
    this.intervals = [];
    if (this.imapClient) {
      try {
        await this.imapClient.logout();
        elizaLogger.debug(`[IMAP:${this.config.user}] ImapFlow stopped`, { userId: this.userId });
      } catch (error: any) {
        elizaLogger.error(`[IMAP:${this.config.user}] Stop failed`, { userId: this.userId, error: error.message });
      } finally {
        this.imapClient = null;
      }
    }
  }

  listen(callback: (mail: ExtendedEmailContent) => void) {
    elizaLogger.debug(`[IMAP:${this.config.user}] Registering email listener`, { userId: this.userId });
    this.on("mail", callback);
  }

  public getHealthStatus(): EmailHealthMetrics {
    return {
      lastSuccessfulFetch: this.lastSuccessfulFetch,
      failedAttempts: this.reconnectAttempts,
      isHealthy: !this.isDisabled && !!this.imapClient && !this.isConnecting,
    };
  }

  async getThreadMessages(threadId: string): Promise<ExtendedEmailContent[]> {
    if (!this.imapClient || this.isDisabled) {
      elizaLogger.debug(`[IMAP:${this.config.user}] Skipping thread fetch: ${!this.imapClient ? "No IMAP client" : "Disabled"}`, { userId: this.userId, threadId });
      return [];
    }
    try {
      const messages = await this.imapClient.search({ header: { "references": threadId } });
      const threadMessages: ExtendedEmailContent[] = [];
      if (Array.isArray(messages)) {
        for (const seq of messages) {
          const message = await this.imapClient.fetchOne(seq, { source: true, envelope: true, headers: true });
          if (message) {
            threadMessages.push(this.parseMessage(message));
          }
        }
        elizaLogger.debug(`[IMAP:${this.config.user}] Fetched ${threadMessages.length} messages for thread`, {
          userId: this.userId,
          threadId,
        });
      } else {
        elizaLogger.debug(`[IMAP:${this.config.user}] No messages found for thread`, {
          userId: this.userId,
          threadId,
        });
      }
      return threadMessages;
    } catch (error: any) {
      elizaLogger.error(`[IMAP:${this.config.user}] Failed to fetch thread messages`, {
        userId: this.userId,
        threadId,
        error: error.message,
      });
      return [];
    }
  }
}

class OutgoingEmailManager {
  private transporter: Transporter;
  private config: OutgoingConfig;

  constructor(config: OutgoingConfig) {
    this.config = config;
    elizaLogger.debug(`[SMTP:${this.config.user}] Initializing OutgoingEmailManager`, { provider: config.provider });
    if (config.provider === EmailOutgoingProvider.GMAIL) {
      this.transporter = nodemailer.createTransport({
        service: "Gmail",
        secure: false,
        auth: { user: config.user, pass: config.pass },
      });
    } else if (config.provider === EmailOutgoingProvider.SMTP) {
      this.transporter = nodemailer.createTransport({
        host: (config as SmtpConfig).host,
        port: (config as SmtpConfig).port,
        secure: (config as SmtpConfig).secure,
        auth: { user: config.user, pass: config.pass },
      });
    } else {
      throw new Error(`Unsupported provider: ${config.provider}`);
    }
  }

  async send(options: SendEmailOptions): Promise<EmailResponse> {
    elizaLogger.debug(`[SMTP:${this.config.user}] Preparing to send email`, {
      from: options.from || this.config.user,
      to: options.to,
      subject: options.subject,
    });
    const mailOptions = {
      from: options.from || this.config.user,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments: options.attachments,
      cc: options.cc,
      bcc: options.bcc,
      replyTo: options.replyTo,
      inReplyTo: options.inReplyTo,
      references: options.references,
      headers: options.headers,
    };
    try {
      const info = await this.transporter.sendMail(mailOptions);
      elizaLogger.debug(`[SMTP:${this.config.user}] Email sent successfully`, {
        messageId: info.messageId,
        response: info.response,
        accepted: info.accepted,
        rejected: info.rejected,
      });
      return {
        success: true,
        messageId: info.messageId,
        response: info.response,
        accepted: info.accepted as string[],
        rejected: info.rejected as string[],
      };
    } catch (error: any) {
      elizaLogger.error(`[SMTP:${this.config.user}] Failed to send email`, {
        error: error.message,
        to: options.to,
        from: options.from || this.config.user,
      });
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

export class EmailClient {
  private incomingEmailManager: IncomingEmailManager | null = null;
  private outgoingEmailManager: OutgoingEmailManager | null = null;
  public type = "email";
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private subscription: any | null = null;
  private lastIsConnected: boolean | null = null;

  constructor(private runtime: IAgentRuntime, private userId: string) {
    elizaLogger.debug(`[EmailClient:${this.userId}] Constructing EmailClient`, { userId, timestamp: new Date().toISOString() });
  }

  async initialize() {
    elizaLogger.debug(`[EmailClient:${this.userId}] Starting initialize`, { userId: this.userId, timestamp: new Date().toISOString() });
    try {
      const incomingConfig = await validateIncomingEmailConfig(this.runtime);
      const outgoingConfig = await validateOutgoingEmailConfig(this.runtime);

      if (incomingConfig) {
        elizaLogger.debug(`[EmailClient:${this.userId}] Incoming config validated`, {
          userId: this.userId,
          host: incomingConfig.host,
          port: incomingConfig.port,
        });
        this.incomingEmailManager = new IncomingEmailManager(incomingConfig, this.userId, this.runtime);
        
        elizaLogger.debug(`[EmailClient:${this.userId}] Setting up email listener`, { userId: this.userId });
        try {
          setupEmailListener(this.runtime, this);
          elizaLogger.debug(`[EmailClient:${this.userId}] Email listener setup completed`, { userId: this.userId });
        } catch (error: any) {
          elizaLogger.error(`[EmailClient:${this.userId}] Failed to set up email listener`, {
            userId: this.userId,
            error: error.message,
            stack: error.stack,
          });
          throw error;
        }

        elizaLogger.debug(`[EmailClient:${this.userId}] Starting IncomingEmailManager`, { userId: this.userId });
        await this.incomingEmailManager.start();
        
        this.setupHealthCheck();
        this.setupSanitySubscription();
      } else {
        elizaLogger.warn(`[EmailClient:${this.userId}] No incoming config, skipping email receiving`, { userId: this.userId });
      }

      if (outgoingConfig) {
        elizaLogger.debug(`[EmailClient:${this.userId}] Outgoing config validated`, {
          userId: this.userId,
          provider: outgoingConfig.provider,
        });
        this.outgoingEmailManager = new OutgoingEmailManager(outgoingConfig);
      } else {
        elizaLogger.warn(`[EmailClient:${this.userId}] No outgoing config, skipping email sending`, { userId: this.userId });
      }
    } catch (error: any) {
      elizaLogger.error(`[EmailClient:${this.userId}] Initialization failed`, { userId: this.userId, error: error.message, stack: error.stack });
      throw error;
    }
  }

  private setupSanitySubscription() {
    const query = `*[_type == "User" && userId == $userId]{isConnected}`;
    const params = { userId: this.userId };
    elizaLogger.debug(`[EmailClient:${this.userId}] Setting up Sanity subscription`, { query, params, timestamp: new Date().toISOString() });

    const debouncedHandleSubscription = debounce(async (event: any) => {
      const isConnected = event.result?.isConnected ?? false;
      elizaLogger.debug(`[SHARED-EMAIL-SANITY] Processed user connection status`, {
        userId: this.userId,
        isConnected,
        eventType: event.type,
        eventId: event.eventId,
        timestamp: new Date().toISOString(),
      });

      if (isConnected !== this.lastIsConnected) {
        if (isConnected) {
          elizaLogger.debug(`[EmailClient:${this.userId}] Sanity subscription: User isConnected changed to true, triggering reconnect`, { userId: this.userId });
          if (this.incomingEmailManager && !this.incomingEmailManager.getHealthStatus().isHealthy) {
            await this.incomingEmailManager.reset();
          } else {
            elizaLogger.debug(`[EmailClient:${this.userId}] Connection already healthy, skipping reconnect`, { userId: this.userId });
          }
        } else {
          elizaLogger.debug(`[EmailClient:${this.userId}] Sanity subscription: User isConnected changed to false, stopping`, { userId: this.userId });
          if (this.incomingEmailManager) {
            await this.incomingEmailManager.stop();
          }
        }
        this.lastIsConnected = isConnected;
      } else {
        elizaLogger.debug(`[EmailClient:${this.userId}] No change in isConnected, skipping action`, { userId: this.userId, isConnected });
      }
    }, 2000);

    try {
      this.subscription = sanityClient
        .listen(query, params, { events: ["welcome", "mutation"], includeResult: true })
        .subscribe((event: any) => {
          elizaLogger.debug(`[SHARED-EMAIL-SANITY] Received Sanity event`, {
            userId: this.userId,
            eventType: event.type,
            eventId: event.eventId,
            isConnected: event.result?.isConnected,
            timestamp: new Date().toISOString(),
          });
          debouncedHandleSubscription(event);
        });
      elizaLogger.debug(`[EmailClient:${this.userId}] Subscribed to Sanity User document changes`, { userId: this.userId });
    } catch (error: any) {
      elizaLogger.error(`[EmailClient:${this.userId}] Failed to set up Sanity subscription`, { userId: this.userId, error: error.message, stack: error.stack });
    }
  }

private setupHealthCheck() {
  let isChecking = false;
  this.healthCheckInterval = setInterval(async () => {
    if (isChecking) {
      elizaLogger.debug(`[EmailClient:${this.userId}] Health check already in progress, skipping`, { userId: this.userId });
      return;
    }
    isChecking = true;
    try {
      const isConnected = await isUserConnected(this.userId);
      const health = this.getHealthStatus();
      elizaLogger.debug(`[EmailClient:${this.userId}] Health check`, { userId: this.userId, isConnected, health });
      if (!isConnected) {
        elizaLogger.debug(`[EmailClient:${this.userId}] User is offline/disconnected, stopping health check`, { userId: this.userId });
        if (this.incomingEmailManager) {
          await this.incomingEmailManager.stop();
        }
        return;
      }
      if (!health.isHealthy && Date.now() - health.lastSuccessfulFetch > 15 * 60 * 1000) {
        elizaLogger.error(`[EmailClient:${this.userId}] Email service unhealthy, attempting recovery`, { userId: this.userId, health });
        if (this.incomingEmailManager && !this.incomingEmailManager.getHealthStatus().isHealthy) {
          await this.incomingEmailManager.reset();
        }
      }
    } finally {
      isChecking = false;
    }
  }, 5 * 60 * 1000);
}

  async send(options: SendEmailOptions): Promise<EmailResponse> {
    if (!this.outgoingEmailManager) {
      elizaLogger.error(`[EmailClient:${this.userId}] Outgoing email not configured`, { userId: this.userId });
      throw new Error("Outgoing email not configured");
    }
    return this.outgoingEmailManager.send(options);
  }

  receive(callback: (mail: ExtendedEmailContent) => void) {
    if (!this.incomingEmailManager) {
      elizaLogger.error(`[EmailClient:${this.userId}] Incoming email not configured`, { userId: this.userId });
      throw new Error("Incoming email not configured");
    }
    this.incomingEmailManager.listen(callback);
  }

  async stop() {
    elizaLogger.debug(`[EmailClient:${this.userId}] Stopping EmailClient`, { userId: this.userId });
    if (this.incomingEmailManager) {
      await this.incomingEmailManager.stop();
    }
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    if (this.subscription) {
      this.subscription.unsubscribe();
      elizaLogger.debug(`[EmailClient:${this.userId}] Unsubscribed from Sanity User document changes`, { userId: this.userId });
      this.subscription = null;
    }
    this.lastIsConnected = null;
  }

  public getHealthStatus(): EmailHealthMetrics {
    return this.incomingEmailManager?.getHealthStatus() || {
      lastSuccessfulFetch: 0,
      failedAttempts: 0,
      isHealthy: false,
    };
  }

  public getImapClient() {
    return this.incomingEmailManager
      ? { isConnected: this.incomingEmailManager.getHealthStatus().isHealthy }
      : { isConnected: false };
  }
}

interface ClientWithType {
  type: string;
  name: string;
  start: (runtime: IAgentRuntime) => Promise<{
    type: string;
    name: string;
    client: EmailClient;
    stop: (runtime: IAgentRuntime) => Promise<boolean>;
    send: (options: SendEmailOptions) => Promise<EmailResponse>;
    receive: (callback: (mail: ExtendedEmailContent) => void) => void;
  }>;
}

export const EmailClientInterface: ClientWithType = {
  type: "email",
  name: "EmailClientInterface",
  start: async (runtime: IAgentRuntime) => {
    elizaLogger.debug(`[EmailClientInterface] Entering start method`, {
      characterId: runtime.character.id,
      createdBy: runtime.character.createdBy,
      createdByType: typeof runtime.character.createdBy,
      timestamp: new Date().toISOString(),
    });
    let userId: string;
    try {
      if (runtime.character.createdBy) {
        userId = await resolveUserIdFromCreatedBy(runtime.character.createdBy);
        if (userId === "unknown") {
          elizaLogger.warn(`[EmailClientInterface] Failed to resolve userId from createdBy`, {
            createdBy: runtime.character.createdBy,
            characterId: runtime.character.id,
          });
          throw new Error(`Cannot initialize EmailClient: invalid createdBy for character ${runtime.character.id}. Ensure createdBy is a valid reference to a User document.`);
        }
      } else {
        elizaLogger.warn(`[EmailClientInterface] Missing createdBy in character document`, {
          createdBy: runtime.character.createdBy,
          characterId: runtime.character.id,
        });
        throw new Error(`Cannot initialize EmailClient: missing createdBy for character ${runtime.character.id}. Ensure createdBy is a valid reference to a User document.`);
      }

      elizaLogger.debug(`[EmailClient:${userId}] Starting EmailClientInterface`, { userId, characterId: runtime.character.id });
      const client = new EmailClient(runtime, userId);
      await client.initialize();
      return {
        type: "email",
        name: "EmailClientInterface",
        client,
        stop: async () => {
          await client.stop();
          elizaLogger.debug(`[EmailClient:${userId}] EmailClient stopped`, { userId });
          return true;
        },
        send: client.send.bind(client),
        receive: client.receive.bind(client),
      };
    } catch (error: any) {
      elizaLogger.error(`[EmailClientInterface] Failed to start EmailClientInterface`, {
        error: error.message,
        stack: error.stack,
        characterId: runtime.character.id,
      });
      throw error;
    }
  },
};

export default EmailClientInterface;