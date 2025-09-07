// import { FC, ReactNode, useMemo } from "react";
// import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
// import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
// import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
// import { clusterApiUrl } from "@solana/web3.js";

// require("@solana/wallet-adapter-react-ui/styles.css");

// interface WalletProviderProps {
//   children: ReactNode;
// }

// const SolanaWalletProvider: FC<WalletProviderProps> = ({ children }) => {
//   const network = "devnet"; // Use 'mainnet-beta' for production
//   const endpoint = useMemo(() => clusterApiUrl(network), [network]);
//   const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

//   return (
//     <ConnectionProvider endpoint={endpoint}>
//       <WalletProvider wallets={wallets} autoConnect>
//         <WalletModalProvider>{children}</WalletModalProvider>
//       </WalletProvider>
//     </ConnectionProvider>
//   );
// };

// export default SolanaWalletProvider;