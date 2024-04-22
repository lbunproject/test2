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
      collectionContract: collection.collection_contract,
      nftContract: collection.nft_contract,
      ipfsJSONPrefix: collection.ipfsJSONPrefix,
      ipfsImagePrefix: collection.ipfsImagePrefix,
      collectionId: collection.id,
      image: collection.image,
      ownedNFTs: [] // Initialize the owned NFTs array
    }));

    for (let collection of collectionsList) {
      // Query for dynamic address
      let query = Buffer.from(JSON.stringify({ owner_all_token_info: { owner: address } })).toString('base64');
      await processQuery(query, collection);
    }

    async function processQuery(query: string, collection: any) {
      const ownedNftsRes = await fetch(`https://terra-classic-lcd.publicnode.com/cosmwasm/wasm/v1/contract/${collection.collectionContract}/smart/${query}`);
      const ownedNftsJson = await ownedNftsRes.json();

      if (ownedNftsJson && ownedNftsJson.data && Array.isArray(ownedNftsJson.data.data)) {
        collection.ownedNFTs = ownedNftsJson.data.data;

        for (const tokens of collection.ownedNFTs || []) {

          let token_Id = tokens.token_id 

          let query2 = Buffer.from(JSON.stringify({ all_nft_info: { token_id: token_Id } })).toString('base64');
          const ownedNftsRes2 = await fetch(`https://terra-classic-lcd.publicnode.com/cosmwasm/wasm/v1/contract/${collection.nftContract}/smart/${query2}`);
          let nftJson = await ownedNftsRes2.json();

          //const nftRes = await fetch(nftJson.data.info.token_uri);
          //nftJson = await nftRes.json();

          if (nftJson) {
            tokenList.push({
              tokenId :token_Id,
              creator: nftJson.creator || "Unknown",
              owner: address,
              tokenUri: "",
              name: nftJson.data.info.extension.name || `NFT ${token_Id}`,
              description: nftJson.description || "No description",
              image: nftJson.data.info.extension.image,
              collection: {
                name: `NFT ${token_Id}`, //collection.title,
                symbol: collection.symbol,
                contractAddress: collection.nftContract,
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


