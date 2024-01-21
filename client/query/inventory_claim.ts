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

export default async function queryClaimInventory(address: string) {

  let collectionsList: CollectionInfo[] = [];
  let tokenList: Media[] = [];
  let stakeContractAddr = "terra1mavdfgzrpak0tq6qfq0spk29km5lym0v36zrtnmdg2aj8ewfpl5qxy3xnc";

  const apiEndpoint = "https://raw.githubusercontent.com/lbunproject/BASEswap-api-price/main/public/stake_collections.json";
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


    // Fetch staked NFTs
    let query = Buffer.from(JSON.stringify({ get_stakings_by_owner: { owner: address } })).toString('base64');
    const stakedNftsRes = await fetch(`https://lcd.miata-ipfs.com/cosmwasm/wasm/v1/contract/${stakeContractAddr}/smart/${query}`);
    const stakedNftsJson = await stakedNftsRes.json();

    // Filter valid staked NFTs
    const validClaimNfts = stakedNftsJson.data.filter((nft: { start_timestamp: any; end_timestamp: string; is_paid: boolean }) => nft.start_timestamp && nft.end_timestamp !== "0" && nft.is_paid === false);

    // Fetch data from blockchain
    for (let validClaimNft of validClaimNfts) {
  
      let query = Buffer.from(JSON.stringify({ all_nft_info: { token_id: validClaimNft.token_id } })).toString('base64');

      const myClaimNftsRes = await fetch(`https://terra-classic-lcd.publicnode.com/cosmwasm/wasm/v1/contract/${validClaimNft.token_address}/smart/${query}`);
      const myClaimNftsJson = await myClaimNftsRes.json();
      
      if (myClaimNftsJson && myClaimNftsJson.data.info) {
        const nftInfo = myClaimNftsJson.data.info;
    
        tokenList.push({
          tokenId: validClaimNft.token_id,
          creator: nftInfo.extension.creator || "Unknown",
          owner: stakeContractAddr,
          tokenUri: nftInfo.token_uri,
          name: nftInfo.extension.name || `NFT ${validClaimNft.token_id}`,
          description: nftInfo.extension.description || "No description",
          image: nftInfo.extension.image,
          collection: {
            name: "Claim Rewards (7 days)",
            symbol: "",
            contractAddress: validClaimNft.token_address,
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


