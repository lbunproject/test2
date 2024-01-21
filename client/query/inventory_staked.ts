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

export default async function queryStakedInventory(address: string) {

  let collectionsList: CollectionInfo[] = [];
  let tokenList: Media[] = [];
  let stakeContractAddr = "terra1axajrsh9f52kv784x7r2w09dmlp50482gwssaeppvn4qcwv0yp2qahcmms";

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
    const validStakedNfts = stakedNftsJson.data.filter((nft: { start_timestamp: any; end_timestamp: string; }) => nft.start_timestamp && nft.end_timestamp === "0");

    // Fetch data from blockchain
    for (let validStakedNft of validStakedNfts) {
  
      let query = Buffer.from(JSON.stringify({ all_nft_info: { token_id: validStakedNft.token_id } })).toString('base64');

      const myStakedNftsRes = await fetch(`https://terra-classic-lcd.publicnode.com/cosmwasm/wasm/v1/contract/${validStakedNft.token_address}/smart/${query}`);
      const myStakedNftsJson = await myStakedNftsRes.json();
      
      if (myStakedNftsJson && myStakedNftsJson.data.info) {
        const nftInfo = myStakedNftsJson.data.info;
    
        tokenList.push({
          tokenId: validStakedNft.token_id,
          creator: nftInfo.extension.creator || "Unknown",
          owner: stakeContractAddr,
          tokenUri: nftInfo.token_uri,
          name: nftInfo.extension.name || `NFT ${validStakedNft.token_id}`,
          description: nftInfo.extension.description || "No description",
          image: nftInfo.extension.image,
          collection: {
            name: "Staked",
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


