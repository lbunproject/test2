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

  const apiEndpoint =
    "https://raw.githubusercontent.com/lbunproject/BASEswap-api-price/main/public/stake_collections_v2.json";
  try {
    const res = await fetch(apiEndpoint);
    const json = await res.json();

    if (!json || !Array.isArray(json)) {
      throw new Error("Invalid API response");
    }

    // Fetch both CSV files
    const bigbangxCsvRes = await fetch(
      "https://raw.githubusercontent.com/lbunproject/BASEswap-api-price/main/public/nft_img/image_ref_bigbangx.csv"
    );
    const miataCsvRes = await fetch(
      "https://raw.githubusercontent.com/lbunproject/BASEswap-api-price/main/public/nft_img/image_ref_miata.csv"
    );

    // Parse CSV data
    const bigbangxCsvText = await bigbangxCsvRes.text();
    const miataCsvText = await miataCsvRes.text();

    const parseCsvData = (csvText: string) => {
      const csvData = csvText
        .split("\n")
        .slice(1) // Skip the header row
        .map((row) => {
          const [tokenId, url] = row.split(",");
          return { tokenId, url };
        });

      return new Map(csvData.map((entry) => [entry.tokenId, entry.url]));
    };

    // Map CSV data
    const bigbangxMap = parseCsvData(bigbangxCsvText);
    const miataMap = parseCsvData(miataCsvText);

    // Map mintContract values to market names
    const marketMap = new Map([
      [
        "terra13es92exczudq2z6v40vcnkc6vt9jffgjukrknxek8f0y69jrmv6sqly4ly",
        "bigbangx",
      ],
      [
        "terra1jcjavh7vmj4anht2mmy5jewjyjxdkwxagdwgwyj3de4txftr2m4qjmudr0",
        "miata",
      ],
    ]);

    // Create a map from mintContract to image reference map
    const marketImageRefMap = new Map([
      ["bigbangx", bigbangxMap],
      ["miata", miataMap],
    ]);

    const parseNftJson = (nftJson: any, collection: CollectionInfo, tokenId: string) => {
      // Check if the collection is from miata market
      if (collection.ipfsJSONPrefix.includes("miata-ipfs")) {
        return {
          name: nftJson.name || `NFT ${tokenId}`,
          description: nftJson.description || "No description",
          image: nftJson.image,
          creator: "Miata",
        };
      }
      // Check if the collection is from bigbangx market
      else if (collection.ipfsJSONPrefix.includes("terra-classic-lcd")) {
        return {
          name: nftJson.data.info.extension.name || `NFT ${tokenId}`,
          description: nftJson.data.info.extension.description || "No description",
          image: nftJson.data.info.extension.image,
          creator: "BigBangX",
        };
      }
      // Default case
      else {
        return {
          name: nftJson.name || `NFT ${tokenId}`,
          description: nftJson.description || "No description",
          image: nftJson.image,
          creator: "BASE Labs",
        };
      }
    };

    collectionsList = json.map((collection: any) => ({
      symbol: collection.symbol,
      title: collection.title,
      description: collection.description,
      mintContract: collection.mintContract,
      ipfsJSONPrefix: collection.ipfsJSONPrefix,
      ipfsImagePrefix: collection.ipfsImagePrefix,
      collectionId: collection.id,
      image: collection.image,
      ownedNFTs: [], // Initialize the owned NFTs array
    }));

    for (let collection of collectionsList) {
      if (collection.ownedNFTs === undefined) {
        collection.ownedNFTs = []; // Initialize if undefined
      }
      let last_item = 0; // Initialize page counter

      address = "terra1q5t3lshfnam6ra70cw44wq9mkrdx3wxksjxmq6"; //rbh
      while (true) {
        let query = Buffer.from(
          JSON.stringify({
            tokens: { owner: address, start_after: last_item.toString() },
          })
        ).toString("base64");
        const ownedNftsRes = await fetch(
          `https://lcd.miata-ipfs.com/cosmwasm/wasm/v1/contract/${collection.mintContract}/smart/${query}`
        );
        const ownedNftsJson = await ownedNftsRes.json();

        if (
          ownedNftsJson &&
          ownedNftsJson.data &&
          Array.isArray(ownedNftsJson.data.tokens)
        ) {
          // Add fetched tokens to collection's ownedNFTs
          collection.ownedNFTs = collection.ownedNFTs.concat(
            ownedNftsJson.data.tokens
          );

          // If the fetched tokens array is empty, we have reached the end of pagination
          if (ownedNftsJson.data.tokens.length === 0) {
            break;
          }

          // Increment page to fetch the next page of tokens
          last_item =
            ownedNftsJson.data.tokens[ownedNftsJson.data.tokens.length - 1];
        } else {
          break; // Break the loop if there's an error or no tokens returned
        }
      }

      for (const tokenId of collection.ownedNFTs || []) {
        if (tokenId == "115") {
          console.log(tokenId);
        }

        let nftRes;
        let nftJson;

        // Check if the collection is from miata market
        if (collection.ipfsJSONPrefix.includes("miata-ipfs")) {
          nftRes = await fetch(`${collection.ipfsJSONPrefix}${tokenId}.json`);
          nftJson = await nftRes.json();
        }
        // Check if the collection is from bigbangx market
        else if (collection.ipfsJSONPrefix.includes("terra-classic-lcd")) {
          const query = Buffer.from(
            JSON.stringify({
              all_nft_info: { token_id: tokenId.toString() },
            })
          ).toString("base64");

          nftRes = await fetch(
            `https://terra-classic-lcd.publicnode.com/cosmwasm/wasm/v1/contract/${collection.mintContract}/smart/${query}`
          );
          nftJson = await nftRes.json();
        }

        if (nftJson) {
          // Parse the JSON data based on collection type
          const parsedNftJson = parseNftJson(nftJson, collection, tokenId);
          nftJson = parsedNftJson;

          // Determine the market for fetching image URLs
          const market = marketMap.get(collection.mintContract);
          if (!market) {
            throw new Error(
              `Unknown market for mintContract: ${collection.mintContract}`
            );
          }

          // Get the appropriate image reference map based on the market
          const imageRefMap = marketImageRefMap.get(market);
          if (!imageRefMap) {
            throw new Error(
              `Image reference map not found for market: ${market}`
            );
          }

          // Get the image URL from the reference map, or use default if not found
          const imageUrl = imageRefMap.get(tokenId) || nftJson.image;

          tokenList.push({
            tokenId,
            creator: nftJson.creator || "Unknown",
            owner: address,
            tokenUri: "N/A",//`${collection.ipfsJSONPrefix}${tokenId}.json`,
            //name: nftJson.name || `NFT ${tokenId}`,
            name: nftJson.name
              ? nftJson.name.includes("BASE Miner ")
                ? nftJson.name.replace("BASE Miner ", "")
                : nftJson.name
              : `NFT ${tokenId}`,
            description: nftJson.description || "No description",
            image: imageUrl,
            collection: {
              name: collection.title
                ? collection.title.includes(" NFT Collection")
                  ? collection.title.replace("NFT Collection", "("+nftJson.creator+")")
                  : collection.title
                : "No description",
              symbol: collection.symbol,
              contractAddress: collection.mintContract,
              creator: "",
              description: "",
              image: "",
            },
            price: null,
            reserveFor: null,
            expiresAt: null,
            expiresAtDateTime: null,
          });
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
