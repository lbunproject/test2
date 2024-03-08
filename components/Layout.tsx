import React, { ReactNode } from "react";
import { MetaTags } from "components";
import Navigation from "./Navigation";
import { useRouter } from "next/router";

import {
  CubeIcon,
  ArrowsUpDownIcon,
  InboxStackIcon,
  EnvelopeIcon,
  LockClosedIcon,
  LockOpenIcon,
  GiftIcon,
} from "@heroicons/react/24/outline";
import { useWallet } from "client";


export default function Layout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { wallet } = useWallet();

  const connectedNavigation = wallet
    ? [{
          name: "Stake",
          href: "/stake",
          icon: LockClosedIcon,
          current: router.asPath.split("/").includes("stake"),
        },
        {
          name: "Unstake",
          href: "/unstake",
          icon: LockOpenIcon,
          current: router.asPath.split("/").includes("unstake"),
        },
        {
          name: "Claim",
          href: "/claim",
          icon: GiftIcon,
          current: router.asPath.split("/").includes("claim"),
        },
      ]
    : [];

  const navigation = [
    /*{
      name: "Trade",
      href: "/stake",
      icon: ArrowsUpDownIcon,
      current: router.asPath.split("/").includes("trade"),
    },*/
    ...connectedNavigation,
  ];

  return (
    <main id="root" className="w-full min-h-screen bg-firefly">
      <div>
        <MetaTags
          title="PixelPact"
          description="P2P trading platform for Terra Classic NFTs"
          image="https://user-images.githubusercontent.com/25516960/186937317-b16cc010-fa80-4a5e-a3bb-45e2413242df.png"
          ogImage="https://user-images.githubusercontent.com/25516960/186937317-b16cc010-fa80-4a5e-a3bb-45e2413242df.png"
          url="https://www.pegasus-trade.zone"
        />
        <Navigation navigation={navigation} />
        <div className="px-8 lg:ml-64">{children}</div>
      </div>
    </main>
  );
}
