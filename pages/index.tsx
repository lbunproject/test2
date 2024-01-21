import type { NextPage } from "next";
import Head from "next/head";
import Image from "next/image";
import stargazeClient from "client/OfflineStargazeClient";
import { useStargazeClient, useWallet } from "client";
import { useEffect } from "react";
import { TxRaw } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import { MsgExecuteContract } from "cosmjs-types/cosmwasm/wasm/v1/tx";
import { toUtf8 } from "@cosmjs/encoding/build/utf8";
import { CONTRACT_ADDRESS } from "util/constants";
import { coins } from "@cosmjs/amino";

const fee = {
  amount: coins(0, process.env.NEXT_PUBLIC_DEFAULT_GAS_DENOM!),
  gas: process.env.NEXT_PUBLIC_DEFAULT_GAS_FEE!,
};

const Home: NextPage = () => {
  const { connect, disconnect, wallet } = useWallet();
  const { client } = useStargazeClient();

  async function handleSendTestOffer() {
    const msgs = [
      {
        typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract",
        value: MsgExecuteContract.fromPartial({
          sender: wallet?.address,
          contract:
            //"stars19hzqtwn7hkw655q84kcsry6f3rzg8gfnk38e23dkjdjurt9ctzqqn38yhu",
            "terra15p7vxrz22yq0l9p7rx7kymn8jjdws0wsm2whgsfjakx4xlxpk8nqy4lckk",
          msg: toUtf8(
            JSON.stringify({
              approve: {
                spender: CONTRACT_ADDRESS,
                token_id: "94",
              },
            })
          ),
          funds: [],
        }),
      },
      {
        typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract",
        value: MsgExecuteContract.fromPartial({
          sender: wallet?.address,
          contract: CONTRACT_ADDRESS,
          msg: toUtf8(
            JSON.stringify({
              create_offer: {
                expires_at: "1703490351",
                offered_nfts: [
                  {
                    collection:
                      //"stars19hzqtwn7hkw655q84kcsry6f3rzg8gfnk38e23dkjdjurt9ctzqqn38yhu",
                      "terra15p7vxrz22yq0l9p7rx7kymn8jjdws0wsm2whgsfjakx4xlxpk8nqy4lckk",
                    token_id: 94,
                  },
                ],
                wanted_nfts: [
                  {
                    collection:
                      //"stars19hzqtwn7hkw655q84kcsry6f3rzg8gfnk38e23dkjdjurt9ctzqqn38yhu",
                      "terra15p7vxrz22yq0l9p7rx7kymn8jjdws0wsm2whgsfjakx4xlxpk8nqy4lckk",
                    token_id: 95,
                  },
                ],
                peer: "terra1ufxzk6s09f8j5vfhk4wwz67x9ck8a897acundy",
              },
            })
          ),
          funds: [],
        }),
      },
    ];

    let signed = await client?.signingCosmWasmClient?.sign(
      wallet?.address!,
      msgs,
      fee,
      ""
    );

    await client?.signingCosmWasmClient
      ?.broadcastTx(Uint8Array.from(TxRaw.encode(signed!).finish()))
      .then((res) => {
        console.log(res);
      });
  }

  return wallet ? (
    <div>
      <p>{wallet.name}</p>
      <button onClick={disconnect}>Disconnect wallet</button>
      <button onClick={handleSendTestOffer}>Send test offer</button>
    </div>
  ) : (
    <button onClick={connect}>Connect wallet</button>
  );
};

export async function getStaticProps() {
  await stargazeClient.connect();

  const data = await stargazeClient.tradeClient?.offersBySender({
    sender: "terra1t3hgyjvunzdq4zuulvheh46h9usp06rm8f94ys",
  });

  console.log(data);

  return { props: {} };
}

export default Home;
