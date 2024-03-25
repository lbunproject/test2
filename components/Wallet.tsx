import { useEffect, SyntheticEvent, useCallback } from "react";

import copy from "copy-to-clipboard";
import { useWallet } from "client";
import { useState } from "react";
import { microAmountMultiplier } from "util/constants";
import ReactTooltip from "@huner2/react-tooltip";

import {
  ArrowRightOnRectangleIcon as LogoutIcon,
  CheckIcon,
  ClipboardIcon as CopyIcon,
} from "@heroicons/react/24/outline";

const Action = ({
  name,
  icon,
  action,
}: {
  name: string;
  icon: React.ReactElement<any, any>;
  action: (e?: SyntheticEvent<Element | Event, Event>) => void;
}) => (
  <>
    <a
      onClick={action}
      data-tip={name}
      data-for="wallet"
      className="cursor-pointer w-7 h-7 rounded p-1.5 text-white hover:bg-firefly-700"
    >
      {icon}
    </a>
  </>
);

export default function Wallet() {
  const [copied, setCopied] = useState<boolean>(false);
  const [feeOptionOneBalance, setFeeOptionOneBalance] = useState<string>('0');
  const [feeOptionTwoBalance, setFeeOptionTwoBalance] = useState<string>('0');
  const { wallet, connect, disconnect } = useWallet();

  const handleCopy = useCallback(
    (e: SyntheticEvent<Element | Event, Event> | undefined) => {
      if (!wallet) return;

      e?.preventDefault();

      copy(wallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    },
    [wallet]
  );

  async function fetchCW20Balance(cw20Address: string, userAddress: string): Promise<string> {

    const query = `{"balance":{"address":"${userAddress}"}}`;
    const encodedQuery = btoa(query);
    const url = `https://terra-classic-lcd.publicnode.com/cosmwasm/wasm/v1/contract/${cw20Address}/smart/${encodedQuery}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      const realBalance = (Number(data.data.balance) / 1000000).toFixed(2).toString();
      return realBalance; // Assuming the response format includes { balance: "amount" }

    } catch (error) {
      console.error("Fetching CW20 balance failed:", error);
      return '0';
    }

  }

  // Fetch CW20 token balances when wallet is connected
  useEffect(() => {
    if (wallet && wallet.address) {
      fetchCW20Balance(process.env.NEXT_PUBLIC_FEE_ADDR_OPTION_ONE!, wallet.address)
        .then(balance => setFeeOptionOneBalance(balance));
      fetchCW20Balance(process.env.NEXT_PUBLIC_FEE_ADDR_OPTION_TWO!, wallet.address)
        .then(balance => setFeeOptionTwoBalance(balance));
    }
  }, [wallet]);

  return wallet ? (
    <div className="flex flex-row items-center justify-between px-4 py-3 mt-3 mb-4 text-white transition duration-150 ease-in-out border rounded-lg cursor-pointer lg:mx-3 lg:mb-0 group hover:border-white/50 border-white/10">
      <div>
        <p className="w-48 text-xs font-medium truncate lg:group-hover:w-32">
          {wallet.name}
        </p>
        <p className="text-xs font-light">
          {new Intl.NumberFormat(`en-US`, {
            style: "currency",
            currency: "USD",
          })
            .format(
              parseFloat(wallet.balance?.amount || "0") / microAmountMultiplier
            )
            .replace("$", "")}{" "}
          LUNC
        </p>
        {/* Display CW20 token balances */}
        <p className="text-xs font-light">
          {feeOptionOneBalance} {process.env.NEXT_PUBLIC_FEE_DENOM_OPTION_ONE}
        </p>
        <p className="text-xs font-light">
          {feeOptionTwoBalance} {process.env.NEXT_PUBLIC_FEE_DENOM_OPTION_TWO}
        </p>
      </div>

      <div>

      </div>

      <div className="flex flex-row space-x-2 lg:hidden lg:group-hover:flex">
        <ReactTooltip
          id="wallet"
          effect="solid"
          type="info"
          className="tooltip"
          arrowColor="rgba(0,0,0,0)"
        />
        <Action
          name="Copy Address"
          icon={copied ? <CheckIcon /> : <CopyIcon />}
          action={handleCopy}
        />
        <Action name="Disconnect" icon={<LogoutIcon />} action={disconnect} />
      </div>
    </div>
  ) : (
    <button
      onClick={connect}
      className="inline-flex items-center justify-center py-4 mt-4 mb-4 text-sm font-medium text-white rounded-lg lg:mb-0 lg:mx-4 bg-primary"
    >
      Connect
    </button>
  );
}
