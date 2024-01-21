import { Bech32Address } from "@keplr-wallet/cosmos";
import { ChainInfo } from "@keplr-wallet/types";

export interface ChainInfoWithExplorer extends ChainInfo {
  // Formed as "https://explorer.com/{txHash}"
  explorerUrlToTx: string;
}

export const ChainInfos: ChainInfoWithExplorer[] = [
  {
    rpc: "https://terra-classic-rpc.publicnode.com:443",
    rest: "https://columbus-lcd.terra.dev",
    chainId: "columbus-5",
    chainName: "LUNA Classic",
    stakeCurrency: {
      coinDenom: "LUNC",
      coinMinimalDenom: "uluna",
      coinDecimals: 6,
      coinGeckoId: "lunc",
      coinImageUrl: "https://ibb.co/3RX0NG9",
    },
    bip44: {
      coinType: 330,
    },
    bech32Config: Bech32Address.defaultBech32Config("terra"),
    currencies: [
      {
        coinDenom: "LUNC",
        coinMinimalDenom: "uluna",
        coinDecimals: 6,
        coinGeckoId: "lunc",
        coinImageUrl: "https://ibb.co/3RX0NG9",
      },
    ],
    feeCurrencies: [
      {
        coinDenom: "LUNC",
        coinMinimalDenom: "uluna",
        coinDecimals: 6,
        coinGeckoId: "lunc",
        coinImageUrl: "https://ibb.co/3RX0NG9",
      },
    ],
    coinType: 330,
    gasPriceStep: {
      low: 0.5,
      average: 1.0,
      high: 1.25,
    },
    features: ["ibc-transfer", "no-legacy-stdTx"],
    explorerUrlToTx: "https://finder.terra-classic.hexxagon.io/mainnet/tx/{txHash}",
  },
];
