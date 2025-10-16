import { CreateWalletResponse } from '@chipi-pay/chipi-sdk';

declare module '@chipi-pay/chipi-sdk' {
  interface ChipiSDK {
    createWallet(params: {
      encryptKey: string;
      bearerToken: string;
    }): Promise<CreateWalletResponse>;
  }
}