// // Ensures the SDK is only loaded in the browser
// const loadChipiSDK = async () => {
//   if (typeof window === "undefined") {
//     throw new Error("Chipi SDK can only be used in a browser environment");
//   }
//   return await import("@chipi-stack/chipi-react");
// };

// export const createChipiWallet = async (
//   params: { encryptKey: string; externalUserId: string },
//   bearerToken: string
// ) => {
//   const { useCreateWallet } = await loadChipiSDK();
//   const { createWalletAsync } = useCreateWallet();
//   return createWalletAsync({ params, bearerToken });
// };

// export const approveToken = async (
//   params: {
//     encryptKey: string;
//     wallet: any; // Replace with proper WalletData type from @chipi-stack/chipi-react
//     contractAddress: string;
//     spender: string;
//     amount: string;
//     decimals: number;
//   },
//   bearerToken: string
// ) => {
//   const { useApprove } = await loadChipiSDK();
//   const { approveAsync } = useApprove();
//   return approveAsync({ params, bearerToken });
// };

// export const getWallet = async (
//   params: { externalUserId: string },
//   getBearerToken: () => Promise<string>
// ) => {
//   const { useGetWallet } = await loadChipiSDK();
//   const { fetchWallet } = useGetWallet();
//   const bearerToken = await getBearerToken();
//   return fetchWallet({ params, getBearerToken: async () => bearerToken });
// };

// export const stakeVesuUsdc = async (
//   params: {
//     encryptKey: string;
//     wallet: any; // Replace with proper WalletData type
//     amount: number;
//     receiverWallet: string;
//   },
//   bearerToken: string
// ) => {
//   const { useStakeVesuUsdc } = await loadChipiSDK();
//   const { stakeVesuUsdcAsync } = useStakeVesuUsdc();
//   return stakeVesuUsdcAsync({ params, bearerToken });
// };