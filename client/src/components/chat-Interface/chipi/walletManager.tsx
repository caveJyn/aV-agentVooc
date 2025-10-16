// import React, { useState, useEffect } from "react";
// import { apiClient } from "@/lib/api";
// import { elizaLogger } from "@elizaos/core";

// interface WalletManagerProps {
//   userId: string;
// }

// const VESU_CONTRACT = "0x037ae3f583c8d644b7556c93a04b83b52fa96159b2b0cbd83c14d3122aef80a2";
// const USDC_CONTRACT = "0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8";

// export const WalletManager: React.FC<WalletManagerProps> = ({ userId }) => {
//   const [pin, setPin] = useState("");
//   const [amount, setAmount] = useState("");
//   const [recipient, setRecipient] = useState("");
//   const [contractAddress, setContractAddress] = useState("");
//   const [entrypoint, setEntrypoint] = useState("");
//   const [calldata, setCalldata] = useState("");
//   const [walletAddress, setWalletAddress] = useState<string | null>(null);
//   const [error, setError] = useState<string | null>(null);
//   const [loading, setLoading] = useState(false);

//   useEffect(() => {
//     const checkWallet = async () => {
//       try {
//         setLoading(true);
//         const response = await apiClient.getWallet(userId);
//         if (response?.accountAddress) {
//           setWalletAddress(response.accountAddress);
//           elizaLogger.debug("[WALLET_MANAGER] Wallet found:", response.accountAddress);
//         }
//       } catch (err: any) {
//         elizaLogger.warn("[WALLET_MANAGER] No wallet found for user:", userId);
//       } finally {
//         setLoading(false);
//       }
//     };
//     checkWallet();
//   }, [userId]);

//   const handleCreateWallet = async () => {
//     if (!pin) {
//       setError("Please enter a PIN");
//       return;
//     }
//     setLoading(true);
//     setError(null);
//     try {
//       const response = await apiClient.createWallet(userId, pin);
//       setWalletAddress(response.walletAddress);
//       setSuccess("Wallet created successfully");
//     } catch (err: any) {
//       setError(err.message || "Failed to create wallet");
//       elizaLogger.error("[WALLET_MANAGER] Create wallet error:", err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleTransferUSDC = async () => {
//     if (!pin || !amount || !recipient) {
//       setError("Please enter PIN, amount, and recipient");
//       return;
//     }
//     setLoading(true);
//     setError(null);
//     try {
//       const response = await apiClient.transferUSDC(userId, pin, amount, recipient);
//       setSuccess("USDC transfer successful");
//     } catch (err: any) {
//       setError(err.message || "Failed to transfer USDC");
//       elizaLogger.error("[WALLET_MANAGER] Transfer USDC error:", err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleApproveToken = async () => {
//     if (!pin || !amount || !contractAddress || !recipient) {
//       setError("Please enter PIN, amount, contract address, and spender");
//       return;
//     }
//     setLoading(true);
//     setError(null);
//     try {
//       const response = await apiClient.approveToken(userId, pin, amount, contractAddress, recipient);
//       setSuccess("Token approval successful");
//     } catch (err: any) {
//       setError(err.message || "Failed to approve token");
//       elizaLogger.error("[WALLET_MANAGER] Approve token error:", err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleStakeUSDC = async () => {
//     if (!pin || !amount || !recipient) {
//       setError("Please enter PIN, amount, and recipient");
//       return;
//     }
//     setLoading(true);
//     setError(null);
//     try {
//       const response = await apiClient.stakeUSDC(userId, pin, amount, recipient);
//       setSuccess("USDC staking successful");
//     } catch (err: any) {
//       setError(err.message || "Failed to stake USDC");
//       elizaLogger.error("[WALLET_MANAGER] Stake USDC error:", err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleWithdrawUSDC = async () => {
//     if (!pin || !amount || !recipient) {
//       setError("Please enter PIN, amount, and recipient");
//       return;
//     }
//     setLoading(true);
//     setError(null);
//     try {
//       const response = await apiClient.withdrawUSDC(userId, pin, amount, recipient);
//       setSuccess("USDC withdrawal successful");
//     } catch (err: any) {
//       setError(err.message || "Failed to withdraw USDC");
//       elizaLogger.error("[WALLET_MANAGER] Withdraw USDC error:", err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleCallContract = async () => {
//     if (!pin || !contractAddress || !entrypoint || !calldata) {
//       setError("Please enter PIN, contract address, entrypoint, and calldata");
//       return;
//     }
//     setLoading(true);
//     setError(null);
//     try {
//       const response = await apiClient.callContract(userId, pin, contractAddress, entrypoint, calldata);
//       setSuccess("Contract call successful");
//     } catch (err: any) {
//       setError(err.message || "Failed to call contract");
//       elizaLogger.error("[WALLET_MANAGER] Call contract error:", err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="bg-white rounded-xl shadow-lg p-6">
//       <h2 className="text-2xl font-bold mb-4">Wallet Manager</h2>
//       {walletAddress ? (
//         <div>
//           <p>Connected Wallet: {walletAddress}</p>
//           <button
//             onClick={() => setWalletAddress(null)}
//             disabled={loading}
//             className="bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 disabled:bg-gray-400"
//           >
//             Disconnect Wallet
//           </button>
//           <div className="mt-4 space-y-4">
//             <h3 className="text-lg font-semibold">Transfer USDC</h3>
//             <input
//               type="password"
//               placeholder="Enter PIN"
//               value={pin}
//               onChange={(e) => setPin(e.target.value)}
//               className="w-full p-2 border rounded-md"
//               disabled={loading}
//             />
//             <input
//               type="number"
//               placeholder="Enter amount"
//               value={amount}
//               onChange={(e) => setAmount(e.target.value)}
//               className="w-full p-2 border rounded-md"
//               disabled={loading}
//             />
//             <input
//               type="text"
//               placeholder="Enter recipient address"
//               value={recipient}
//               onChange={(e) => setRecipient(e.target.value)}
//               className="w-full p-2 border rounded-md"
//               disabled={loading}
//             />
//             <button
//               onClick={handleTransferUSDC}
//               disabled={loading}
//               className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:bg-gray-400"
//             >
//               {loading ? "Processing..." : "Transfer USDC"}
//             </button>

//             <h3 className="text-lg font-semibold">Approve Token</h3>
//             <input
//               type="text"
//               placeholder="Enter contract address"
//               value={contractAddress}
//               onChange={(e) => setContractAddress(e.target.value)}
//               className="w-full p-2 border rounded-md"
//               disabled={loading}
//             />
//             <input
//               type="text"
//               placeholder="Enter spender address"
//               value={recipient}
//               onChange={(e) => setRecipient(e.target.value)}
//               className="w-full p-2 border rounded-md"
//               disabled={loading}
//             />
//             <button
//               onClick={handleApproveToken}
//               disabled={loading}
//               className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
//             >
//               {loading ? "Approving..." : "Approve Token"}
//             </button>

//             <h3 className="text-lg font-semibold">Stake USDC</h3>
//             <button
//               onClick={handleStakeUSDC}
//               disabled={loading}
//               className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
//             >
//               {loading ? "Staking..." : "Stake USDC"}
//             </button>

//             <h3 className="text-lg font-semibold">Withdraw USDC</h3>
//             <button
//               onClick={handleWithdrawUSDC}
//               disabled={loading}
//               className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
//             >
//               {loading ? "Withdrawing..." : "Withdraw USDC"}
//             </button>

//             <h3 className="text-lg font-semibold">Call Contract</h3>
//             <input
//               type="text"
//               placeholder="Enter entrypoint"
//               value={entrypoint}
//               onChange={(e) => setEntrypoint(e.target.value)}
//               className="w-full p-2 border rounded-md"
//               disabled={loading}
//             />
//             <input
//               type="text"
//               placeholder="Enter calldata (JSON array)"
//               value={calldata}
//               onChange={(e) => setCalldata(e.target.value)}
//               className="w-full p-2 border rounded-md"
//               disabled={loading}
//             />
//             <button
//               onClick={handleCallContract}
//               disabled={loading}
//               className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
//             >
//               {loading ? "Processing..." : "Call Contract"}
//             </button>
//           </div>
//         </div>
//       ) : (
//         <div>
//           <h3 className="text-lg font-semibold">Create Wallet</h3>
//           <input
//             type="password"
//             placeholder="Enter PIN"
//             value={pin}
//             onChange={(e) => setPin(e.target.value)}
//             className="w-full p-2 border rounded-md"
//             disabled={loading}
//           />
//           <button
//             onClick={handleCreateWallet}
//             disabled={loading}
//             className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:bg-gray-400"
//           >
//             {loading ? "Creating..." : "Create Wallet"}
//           </button>
//           {error && <p className="mt-4 text-red-700">{error}</p>}
//         </div>
//       )}
//     </div>
//   );
// };