// packages/plugin-chipi/src/client/chipiPayClient.ts
type ApproveParams = {
  // Define based on @chipi-stack/chipi-react types
  amount: string;
  token: string;
};

type CreateWalletParams = {
  encryptKey: string;
  externalUserId: string;
};

type CreateWalletResponse = {
  walletPublicKey: string;
  txHash: string;
};

type GetWalletResponse = {
  publicKey: string;
  createdAt: string;
};

type ApproveInput = {
  params: ApproveParams;
  bearerToken: string;
};

const logger = {
  log: (msg: string, meta?: any) => console.log(msg, meta),
  info: (msg: string, meta?: any) => console.info(msg, meta),
  warn: (msg: string, meta?: any) => console.warn(msg, meta),
  error: (msg: string, error?: any) => console.error(msg, error),
  success: (msg: string, meta?: any) => console.log(msg, meta),
};



export class ChipiPayClient {
  private apiPublicKey: string;
  private isClient: boolean;

  constructor(config: { apiPublicKey: string }) {
    this.apiPublicKey = config.apiPublicKey;
    this.isClient = typeof window !== "undefined";

    logger.log("⚙️ Constructing ChipiPayClient", {
      clientSide: this.isClient,
      apiKey: this.apiPublicKey ? "[REDACTED]" : undefined,
    });
  }

  async start(): Promise<void> {
    if (!this.isClient) {
      logger.warn("🧱 ChipiPayClient.start() called on server — skipping initialization");
      return;
    }

    try {
      // Ensure hooks are available (dynamic import for client-side only)
      await import("@chipi-stack/chipi-react");
      logger.success("✅ ChipiPayClient ready (ChipiProvider/hooks loaded)");
    } catch (error) {
      logger.error("❌ Failed to load Chipi hooks/provider:", error);
      throw error;
    }
  }

  async createWallet(pin: string, agentId: string): Promise<CreateWalletResponse | null> {
    if (!this.isClient) {
      logger.error("❌ ChipiPayClient.createWallet must be executed in browser context");
      throw new Error("ChipiPayClient.createWallet must be executed in browser context");
    }

    try {
      const { useCreateWallet } = await import("@chipi-stack/chipi-react");
      const { useAuth } = await import("@clerk/clerk-react");

      const { createWalletAsync } = useCreateWallet();
      const { getToken } = useAuth();
      const token = await getToken();
      if (!token) {
        logger.error("🔒 Missing Clerk session token");
        throw new Error("Missing Clerk session token");
      }

      const response = await createWalletAsync({
        params: { encryptKey: pin, externalUserId: agentId },
        bearerToken: token,
      });

      logger.success("💼 Wallet created successfully", {
        publicKey: response.walletPublicKey,
        txHash: response.txHash,
      });
      return response;
    } catch (error) {
      logger.error("❌ Failed to create Chipi wallet:", error);
      return null;
    }
  }

  async approveToken(params: ApproveInput): Promise<string | null> {
    if (!this.isClient) {
      logger.error("❌ ChipiPayClient.approveToken must be executed in browser");
      throw new Error("ChipiPayClient.approveToken must be executed in browser");
    }

    try {
      const { useApprove } = await import("@chipi-stack/chipi-react");
      const { useAuth } = await import("@clerk/clerk-react");

      const { approveAsync } = useApprove();
      const { getToken } = useAuth();
      const token = await getToken();
      if (!token) {
        logger.error("🔒 Missing Clerk session token");
        throw new Error("Missing Clerk session token");
      }

      const result = await approveAsync({ ...params, bearerToken: token });
      logger.success("✅ Token approved successfully", { result });
      return result;
    } catch (error) {
      logger.error("❌ Failed to approve token:", error);
      return null;
    }
  }

  async getWallet(): Promise<GetWalletResponse | null> {
    if (!this.isClient) {
      logger.error("❌ ChipiPayClient.getWallet must be executed in browser");
      throw new Error("ChipiPayClient.getWallet must be executed in browser");
    }

    try {
      const { useGetWallet } = await import("@chipi-stack/chipi-react");
      const { useAuth } = await import("@clerk/clerk-react");

      const { getToken } = useAuth();
      const token = await getToken();
      if (!token) {
        logger.error("🔒 Missing Clerk session token");
        throw new Error("Missing Clerk session token");
      }

      const { fetchWallet } = useGetWallet({ getBearerToken: async () => token });
      const response = await fetchWallet({});
      logger.success("💰 Wallet fetched successfully", { publicKey: response.publicKey });
      return response;
    } catch (error) {
      logger.error("❌ Failed to fetch wallet:", error);
      return null;
    }
  }

  async pay(to: string, amount: string) {
    if (!this.isClient) {
      logger.error("❌ pay() only available in browser context");
      throw new Error("pay() only available in browser context");
    }
    logger.info(`💸 Simulated payment to ${to} for ${amount}`);
  }

  async stop(): Promise<void> {
    logger.log("🛑 ChipiPayClient stopped");
  }

  async generateProof(userId: string, txHash: string) {
    logger.log(`[ChipiService] Generating proof for ${txHash}`);
  }
}