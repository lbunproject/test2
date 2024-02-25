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

export default async function queryClaimInventory(address: string) {
  let collectionsList: CollectionInfo[] = [];
  let collectionAttributes: CollectionAttribute[] = [];
  let tokenList: Media[] = [];
  let stakeContractAddr = 
    "terra1sztr8gsqfq30c5wxda7k2skjled3pzp848x07e4tduua37y04s6qst7cgw";

  const apiEndpoint = 
    "https://raw.githubusercontent.com/lbunproject/BASEswap-api-price/main/public/stake_collections_v2.json";
  try {
    const res = await fetch(apiEndpoint);
    const json = await res.json();

    if (!json || !Array.isArray(json)) {
      throw new Error('Invalid API response');
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

    // Fetch additional collection info from the CosmWasm contract
    const additionalInfoRes = await fetch(`https://lcd.miata-ipfs.com/cosmwasm/wasm/v1/contract/${stakeContractAddr}/smart/eyJnZXRfY29sbGVjdGlvbnMiOnt9fQ==`
    );
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

    // Filter valid unstaked NFTs
    const validClaimNfts = stakedNftsJson.data.filter((nft: { end_timestamp: string; is_paid: boolean }) =>
      nft.end_timestamp != "0" && nft.is_paid == false);

    // Fetch data from blockchain
    for (let validClaimNft of validClaimNfts) {

      let query = Buffer.from(JSON.stringify({ all_nft_info: { token_id: validClaimNft.token_id } })).toString('base64');

      const myClaimNftsRes = await fetch(`https://terra-classic-lcd.publicnode.com/cosmwasm/wasm/v1/contract/${validClaimNft.token_address}/smart/${query}`
      );
      const myClaimNftsJson = await myClaimNftsRes.json();

      if (myClaimNftsJson && myClaimNftsJson.data.info) {
        const nftInfo = myClaimNftsJson.data.info;
        let staking_time = (validClaimNft.end_timestamp - validClaimNft.start_timestamp) / 1000000000; //in seconds
        let unstaked_time = ((Date.now() * 1000000) - (validClaimNft.end_timestamp)) / 1000000000; //in seconds
        
        // Find the collection attribute for this NFT
        const collectionAttribute = collectionAttributes.find(attr => attr.collectionContract === validClaimNft.token_address);

        //Access attributes;   collectionAttribute?.cycle?.toString() ?? "", // Get cycle with Optional Chaining
        const staking_cycles = staking_time / Number(collectionAttribute?.cycle) ?? 1  //staking cycles

        unstaked_time = Number(collectionAttribute?.claim_delay) - unstaked_time
        if (unstaked_time < 0) {
          unstaked_time = 0
        } else {
          unstaked_time = unstaked_time / (24 * 60 * 60) //in days
        }


        // Determine the market for fetching image URLs
        const market = marketMap.get(validClaimNft.token_address);
        if (!market) {
          throw new Error(
            `Unknown market for mintContract: ${validClaimNft.token_address}`
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
        const imageUrl =
          imageRefMap.get(validClaimNft.token_id) || nftInfo.image;

        //Info to display
        const earnedRewards = ((Number(collectionAttribute?.reward_amount) / 1000000) * Number(staking_cycles)).toFixed(1)
        const inDays = unstaked_time != 0 ? 'Release in: '+ String((unstaked_time).toFixed(2)) + " days" : 'Vesting: Complete'

        tokenList.push({
          tokenId: validClaimNft.token_id,
          creator: nftInfo.extension.creator || "Unknown",
          owner: stakeContractAddr,
          tokenUri: nftInfo.token_uri,
          name: earnedRewards + ' cwLUNC ',
          description: nftInfo.extension.description || "No description",
          image: imageUrl,
          collection: {
            name: inDays,
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


