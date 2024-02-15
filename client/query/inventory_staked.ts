import { NFT_API } from "util/constants";
import { Media } from "util/type";

type CollectionInfo = {
  symbol: string;
  title: string;
  description: string;
  mintContract: string;
  ipfsJSONPrefix: string;
  ipfsImagePrefix: string;
  collectionId: number;
  image: string;
  ownedNFTs?: string[];
};

type CollectionAttribute = {
  collectionContract: string;
  cycle?: number;
  claim_delay?: number;
  reward_amount?: string;
};

export default async function queryStakedInventory(address: string) {

  let collectionsList: CollectionInfo[] = [];
  let collectionAttributes: CollectionAttribute[] = [];
  let tokenList: Media[] = [];
  let stakeContractAddr = "terra1sztr8gsqfq30c5wxda7k2skjled3pzp848x07e4tduua37y04s6qst7cgw";

  const apiEndpoint = "https://raw.githubusercontent.com/lbunproject/BASEswap-api-price/main/public/stake_collections_v2.json";
  try {
    const res = await fetch(apiEndpoint);
    const json = await res.json();

    if (!json || !Array.isArray(json)) {
      throw new Error('Invalid API response');
    }

    collectionsList = json.map((collection: any) => ({
      symbol: collection.symbol,
      title: collection.title,
      description: collection.description,
      mintContract: collection.mintContract,
      ipfsJSONPrefix: collection.ipfsJSONPrefix,
      ipfsImagePrefix: collection.ipfsImagePrefix,
      collectionId: collection.id,
      image: collection.image,
      ownedNFTs: [] // Initialize the owned NFTs array
    }));

    // Fetch additional collection info from the CosmWasm contract
    const additionalInfoRes = await fetch(`https://lcd.miata-ipfs.com/cosmwasm/wasm/v1/contract/${stakeContractAddr}/smart/eyJnZXRfY29sbGVjdGlvbnMiOnt9fQ==`);
    const additionalInfoJson = await additionalInfoRes.json();
    const additionalInfo = additionalInfoJson.data;

    // Create collectionAttributes array
    collectionAttributes = collectionsList.map((collection) => {
      const match = additionalInfo.find((info: any) => info.collection_addr === collection.mintContract);
      return {
        collectionContract: collection.mintContract, // Correctly reference the contract
        cycle: match?.cycle || 0, // Provide default values if not found
        claim_delay: match?.claim_delay || 0,
        reward_amount: match?.reward_amount || "",
      };
    });
    
    // Fetch staked NFTs
    let query = Buffer.from(JSON.stringify({ get_stakings_by_owner: { owner: address } })).toString('base64');
    const stakedNftsRes = await fetch(`https://lcd.miata-ipfs.com/cosmwasm/wasm/v1/contract/${stakeContractAddr}/smart/${query}`);
    const stakedNftsJson = await stakedNftsRes.json();

    // Filter valid staked NFTs
    const validStakedNfts = stakedNftsJson.data.filter((nft: { start_timestamp: any; end_timestamp: string; }) =>
     nft.start_timestamp && nft.end_timestamp === "0");

    // Fetch data from blockchain
    for (let validStakedNft of validStakedNfts) {
  
      let query = Buffer.from(JSON.stringify({ all_nft_info: { token_id: validStakedNft.token_id } })).toString('base64');

      const myStakedNftsRes = await fetch(`https://terra-classic-lcd.publicnode.com/cosmwasm/wasm/v1/contract/${validStakedNft.token_address}/smart/${query}`);
      const myStakedNftsJson = await myStakedNftsRes.json();
      
      if (myStakedNftsJson && myStakedNftsJson.data.info) {
        const nftInfo = myStakedNftsJson.data.info;
        let staking_time = ((Date.now() * 1000000) - (validStakedNft.start_timestamp)) / 1000000000; //in seconds

        // Find the collection attribute for this NFT
        const collectionAttribute = collectionAttributes.find(attr => attr.collectionContract === validStakedNft.token_address);

        //Access attributes;   collectionAttribute?.cycle?.toString() ?? "", // Get cycle with Optional Chaining
        const staking_cycles = staking_time / Number(collectionAttribute?.cycle) ?? 1  //staking cycles

        let delay_time = Number(collectionAttribute?.claim_delay) / (24 * 60 * 60) //in days
        if (delay_time < 1) {
          delay_time = 0
        } else {
          delay_time = Math.ceil(delay_time)
        }

        //Info to display
        const earnedRewards = ((Number(collectionAttribute?.reward_amount) / 1000000) * Number(staking_cycles)).toFixed(2)
        //const inDays = '(in ' + String(delay_time.toFixed(0)) + " days)"

        tokenList.push({
          tokenId: validStakedNft.token_id,
          creator: nftInfo.extension.creator || "Unknown",
          owner: stakeContractAddr,
          tokenUri: nftInfo.token_uri,
          name:  earnedRewards + ' cwLUNC',
          description: nftInfo.extension.description || "No description",
          image: nftInfo.extension.image,
          collection: {
            name:  'Staking Rewards',
            symbol: "",
            contractAddress: validStakedNft.token_address,
            creator: "",
            description: "",
            image: ""
          },
          price: nftInfo.ask_price,
          reserveFor: null,
          expiresAt: null,
          expiresAtDateTime: null
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


