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

export default async function queryWalletInventory(address: string) {

  let collectionsList: CollectionInfo[] = [];
  let tokenList: Media[] = [];

  const apiEndpoint = `${process.env.NEXT_PUBLIC_API_ENDPOINT}/${process.env.NEXT_PUBLIC_COLLECTION_JSON}`;
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
      image: collection.ipfsImagePrefix + "1.png",
      ownedNFTs: [] // Initialize the owned NFTs array
    }));

    for (let collection of collectionsList) {
      // Query for dynamic address
      let query = Buffer.from(JSON.stringify({ tokens: { owner: address } })).toString('base64');
      await processQuery(query, collection);
    }

    async function processQuery(query: string, collection: any) {
      const ownedNftsRes = await fetch(`https://lcd.miata-ipfs.com/cosmwasm/wasm/v1/contract/${collection.mintContract}/smart/${query}`);
      const ownedNftsJson = await ownedNftsRes.json();

      if (ownedNftsJson && ownedNftsJson.data && Array.isArray(ownedNftsJson.data.tokens)) {
        collection.ownedNFTs = ownedNftsJson.data.tokens;

        for (const tokenId of collection.ownedNFTs || []) {

          let query2 = Buffer.from(JSON.stringify({ all_nft_info: { token_id: tokenId, include_expired: true } })).toString('base64');
          const ownedNftsRes2 = await fetch(`https://lcd.miata-ipfs.com/cosmwasm/wasm/v1/contract/${collection.mintContract}/smart/${query2}`);
          let nftJson = await ownedNftsRes2.json();

          const nftRes = await fetch(nftJson.data.info.token_uri);
          nftJson = await nftRes.json();

          if (nftJson) {
            tokenList.push({
              tokenId,
              creator: nftJson.creator || "Unknown",
              owner: address,
              tokenUri: "",
              name: nftJson.name || `NFT ${tokenId}`,
              description: nftJson.description || "No description",
              image: nftJson.image,
              collection: {
                name: collection.title,
                symbol: collection.symbol,
                contractAddress: collection.mintContract,
                creator: "",
                description: "",
                image: ""
              },
              price: null,
              reserveFor: null,
              expiresAt: null,
              expiresAtDateTime: null
            });
          }
        }
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


