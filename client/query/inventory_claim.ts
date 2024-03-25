import { NFT_API } from "util/constants";
import { Media } from "util/type";

type CollectionInfo = {
  symbol: string;
  title: string;
  description: string;
  collectionContract: string;
  nftContract: string;
  ipfsJSONPrefix: string;
  ipfsImagePrefix: string;
  collectionId: number;
  image: string;
  ownedNFTs?: string[];
};

type CollectionAttribute = {
  nftContract: string;
  cycle?: number;
  claim_delay?: number;
  reward_amount?: string;
};

export default async function queryClaimInventory(address: string) {
  let collectionsList: CollectionInfo[] = [];
  let collectionAttributes: CollectionAttribute[] = [];
  let tokenList: Media[] = [];
  let stakeContractAddr = `${process.env.NEXT_PUBLIC_STAKE_CONTRACT!}`;

  const apiEndpoint = `${process.env.NEXT_PUBLIC_API_ENDPOINT!}/${process.env
    .NEXT_PUBLIC_COLLECTION_JSON!}`;
  try {
    const res = await fetch(apiEndpoint);
    const json = await res.json();

    if (!json || !Array.isArray(json)) {
      throw new Error("Invalid API response");
    }

    collectionsList = json.map((collection: any) => ({
      symbol: collection.symbol,
      title: collection.title,
      description: collection.description,
      collectionContract: collection.collection_contract,
      nftContract: collection.nft_contract,
      ipfsJSONPrefix: collection.ipfsJSONPrefix,
      ipfsImagePrefix: collection.ipfsImagePrefix,
      collectionId: collection.id,
      image:
        collection.ipfsImagePrefix +
        "QmVq9Ux1NDjApHPzUKQrCYzXJ26cShSgTGkT9eLbz6pFiu",
      ownedNFTs: [], // Initialize the owned NFTs array
    }));

    // Fetch additional collection info from the CosmWasm contract
    const additionalInfoRes = await fetch(
      `https://terra-classic-lcd.publicnode.com/cosmwasm/wasm/v1/contract/${stakeContractAddr}/smart/eyJnZXRfY29sbGVjdGlvbnMiOnt9fQ==`
    );
    const additionalInfoJson = await additionalInfoRes.json();
    const additionalInfo = additionalInfoJson.data;

    // Create collectionAttributes array
    collectionAttributes = collectionsList.map((collection) => {
      const match = additionalInfo.find(
        (info: any) => info.collection_addr === collection.nftContract
      );
      return {
        nftContract: collection.nftContract, // Correctly reference the contract
        cycle: match?.cycle || 0, // Provide default values if not found
        claim_delay: match?.claim_delay || 0,
        reward_amount: match?.reward_amount || "",
      };
    });

    // Fetch staked NFTs
    let query = Buffer.from(
      JSON.stringify({ get_stakings_by_owner: { owner: address } })
    ).toString("base64");
    const stakedNftsRes = await fetch(
      `https://terra-classic-lcd.publicnode.com/cosmwasm/wasm/v1/contract/${stakeContractAddr}/smart/${query}`
    );
    const stakedNftsJson = await stakedNftsRes.json();

    // Filter valid unstaked NFTs
    const validClaimNfts = stakedNftsJson.data.filter(
      (nft: { end_timestamp: string; is_paid: boolean }) =>
        nft.end_timestamp != "0" && nft.is_paid == false
    );

    // Fetch data from blockchain
    for (let validClaimNft of validClaimNfts) {
      let query = Buffer.from(
        JSON.stringify({ all_nft_info: { token_id: validClaimNft.token_id } })
      ).toString("base64");

      const myClaimNftsRes = await fetch(
        `https://terra-classic-lcd.publicnode.com/cosmwasm/wasm/v1/contract/${validClaimNft.token_address}/smart/${query}`
      );
      const myClaimNftsJson = await myClaimNftsRes.json();

      if (myClaimNftsJson && myClaimNftsJson.data.info) {
        const nftInfo = myClaimNftsJson.data.info;
        let staking_time =
          (validClaimNft.end_timestamp - validClaimNft.start_timestamp) /
          1000000000; //in seconds
        let unstaked_time =
          (Date.now() * 1000000 - validClaimNft.end_timestamp) / 1000000000; //in seconds

        // Find the collection attribute for this NFT
        const collectionAttribute = collectionAttributes.find(
          (attr) => attr.nftContract === validClaimNft.token_address
        );

        //Access attributes;   collectionAttribute?.cycle?.toString() ?? "", // Get cycle with Optional Chaining
        const staking_cycles =
          staking_time / Number(collectionAttribute?.cycle) ?? 1; //staking cycles

        unstaked_time =
          Number(collectionAttribute?.claim_delay) - unstaked_time;
        if (unstaked_time < 0) {
          unstaked_time = 0;
        } else {
          unstaked_time = unstaked_time / (24 * 60 * 60); //in days
        }

        const data = JSON.parse(JSON.stringify(additionalInfo[0]));
        const levels = [data.lvl2, data.lvl3, data.lvl4, data.lvl5, data.lvl6];
        const multipliers = [
          data.mul2,
          data.mul3,
          data.mul4,
          data.mul5,
          data.mul6,
        ];
        let multiplier = 1;
        for (let i = 0; i < levels.length; i++) {
          if (levels[i].includes(Number(validClaimNft.token_id))) {
            multiplier = multipliers[i] / 100;
            break;
          }
        }

        //Info to display
        const earnedRewards = (
          ((Number(collectionAttribute?.reward_amount) * multiplier) /
            1000000) *
          Number(staking_cycles)
        ).toFixed(1);

        let inDays = "";
        // Assuming unstaked_time is in days and can be a fraction
        if (unstaked_time <= 0) {
          // Covers the case where unstaked_time is exactly 0 or somehow negative
          inDays = "Vesting: Complete";
        } else if (unstaked_time < 0.001) {
          // Adjust this threshold as needed based on how you define "immediate" unlocking
          inDays = "Unlocking";
        } else {
          // For all other positive values of unstaked_time
          inDays = `Release in: ${unstaked_time.toFixed(3)} days`;
        }

        tokenList.push({
          tokenId: validClaimNft.token_id,
          creator: nftInfo.extension.creator || "Unknown",
          owner: stakeContractAddr,
          tokenUri: nftInfo.token_uri,
          name:
            earnedRewards + " " + `${process.env.NEXT_PUBLIC_REWARD_DENOM!}`,
          description: nftInfo.extension.description || "No description",
          image: nftInfo.extension.image,
          collection: {
            name: inDays,
            symbol: "",
            contractAddress: validClaimNft.token_address,
            creator: "",
            description: "",
            image: "",
          },
          price: nftInfo.ask_price,
          reserveFor: null,
          expiresAt: null,
          expiresAtDateTime: null,
        });
      }
    }
  } catch (error) {
    console.error(error);
    return [];
  }

  if (Array.isArray(tokenList)) {
    // sort by nft name
    tokenList.sort((a: any, b: any) =>
      a.name.localeCompare(b.name, undefined, { numeric: true })
    );
  }

  return tokenList;
}
