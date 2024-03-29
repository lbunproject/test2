import React, { ChangeEvent, useState, useCallback, useEffect } from 'react'
import { useStargazeClient, useWallet } from 'client'
import { fromBech32, toUtf8 } from '@cosmjs/encoding'
import { useRouter } from 'next/router'
import { MsgExecuteContract } from 'cosmjs-types/cosmwasm/wasm/v1/tx'
import useToaster, { ToastTypes } from 'hooks/useToaster'
import { useTx } from 'contexts/tx'
import { parse } from 'path'

const IndexPage: React.FC = () => {
  const { wallet } = useWallet()
  const { tx } = useTx()
  const { client } = useStargazeClient()

  const toaster = useToaster()
  const router = useRouter()
  const rarities = `${process.env.NEXT_PUBLIC_NFT_Rarities}`.split(',');

  // State for enabling/disabling contract
  let [contractAddress, setContractAddress] = useState<string>('');
  let [rewardTokenAddress, setRewardTokenAddress] = useState('');

  let [selectedLevel, setSelectedLevel] = useState(''); // State to store selected level
  let [nftNumbers, setNftNumbers] = useState(''); // State to store NFT numbers
  let [rewardAmount, setRewardAmount] = useState(''); // State to store reward amount

  let [amount, setAmount] = useState('');
  let [transactionType, setTransactionType] = useState('Deposit');
  let [collectionAddresses, setCollectionAddresses] = useState<string[]>([]);
  let [selectedCollectionAddress, setSelectedCollectionAddress] = useState('');
  const [poolAmount, setPoolAmount] = useState('');

  useEffect(() => {
    const fetchRewardTokenAddress = async () => {
      try {
        const response = await fetch(`https://terra-classic-lcd.publicnode.com/cosmwasm/wasm/v1/contract/${process.env.NEXT_PUBLIC_STAKE_CONTRACT!}/smart/eyJnZXRfY29uZmlnIjp7fX0=`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setRewardTokenAddress(data.data.reward_token);
        console.log("Reward token address:", data.data.reward_token);
        localStorage.setItem('rewardTokenAddress', data.data.reward_token);
      } catch (error) {
        console.error("Fetching reward token address failed:", error);
      }
    };
    fetchRewardTokenAddress();
  }, []);

  // Define an interface that describes the structure of each item in the data array
  interface CollectionItem {
    collection_addr: string;
    // Include other properties as necessary
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`https://terra-classic-lcd.publicnode.com/cosmwasm/wasm/v1/contract/${process.env.NEXT_PUBLIC_STAKE_CONTRACT!}/smart/eyJnZXRfY29sbGVjdGlvbnMiOnt9fQ==`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        const addresses = data.data.map((item: CollectionItem) => item.collection_addr);
        setCollectionAddresses(addresses);
        setSelectedCollectionAddress(addresses[0]);
        localStorage.setItem('selectedCollectionAddress', selectedCollectionAddress);
      } catch (error) {
        console.error("Fetching collection addresses failed:", error);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (transactionType === 'Deposit') {
      setAmount('0');
    } else if (transactionType === 'Withdraw') {
      const fetchPoolAmount = async () => {
        const query = `{"get_pool_amount":{"collection_addr":"${selectedCollectionAddress}"}}`;
        const encodedQuery = btoa(query);
        const url = `https://terra-classic-lcd.publicnode.com/cosmwasm/wasm/v1/contract/${process.env.NEXT_PUBLIC_STAKE_CONTRACT!}/smart/${encodedQuery}`;

        try {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const data = await response.json();
          const amount = data.data.pool_amount / 1000000; // Dividing by 1,000,000 to adjust the amount
          setPoolAmount(amount.toString());
        } catch (error) {
          console.error("Fetching pool amount failed:", error);
        }
      };

      fetchPoolAmount();
    }
  }, [selectedCollectionAddress, transactionType]); // This effect depends on the collectionAddress



  // Handler for depositing reward tokens
  const handleDeposit = useCallback(async (amountValue: number, collection_addr: string) => {

    const savedAddress = localStorage.getItem('selectedCollectionAddress');
    // Check if savedAddress is not null and collection_addr is different from savedAddress
    if (savedAddress && collection_addr !== savedAddress) {
      collection_addr = savedAddress;
    }


    const cw20_addr = localStorage.getItem('rewardTokenAddress') ?? undefined;

    // Check if deposit amount is valid
    if (isNaN(amountValue) || amountValue <= 0) {
      alert('Please enter a valid deposit amount.');
      return;
    }

    // Multiply deposit amount by 1,000,000 to convert to u128
    const u128Amount = Math.ceil(amountValue * 1000000);

    // Fee portion of the transaction
    const encoder = new TextEncoder();

    let InnerMsg = btoa(String.fromCharCode(...encoder.encode(JSON.stringify({
      deposit_collection_reward: {
        collection_addr: collection_addr
      }
    }))));

    const sendMsg = {
      send: {
        amount: u128Amount.toString(),
        contract: `${process.env.NEXT_PUBLIC_STAKE_CONTRACT!}`,
        msg: InnerMsg,
      }
    };

    const WrapperMsg = {
      typeUrl: '/cosmwasm.wasm.v1.MsgExecuteContract',
      value: MsgExecuteContract.fromPartial({
        contract: cw20_addr,
        sender: wallet?.address,
        msg: toUtf8(JSON.stringify(sendMsg)),
      })
    };

    const totalGas = 3499999; //one transaction is cw20

    tx([WrapperMsg], { gas: totalGas }, () => {
      router.push('/manage');
    });
  }, [
    wallet,
    tx, // Include tx if it's a prop or state
    router, // Include router if it's a prop or state
    // Add any other dependencies here
  ]);

  // Handler for withdrawing reward tokens
  const handleWithdraw = useCallback(async (collection_addr: string) => {
    // Check if withdraw amount is valid

    const savedAddress = localStorage.getItem('selectedCollectionAddress');
    // Check if savedAddress is not null and collection_addr is different from savedAddress
    if (savedAddress && collection_addr !== savedAddress) {
      collection_addr = savedAddress;
    }

    // Create and send ExecuteMsg for withdrawing reward
    const withdrawMsg = {
      withdraw_collection_reward: {
        collection_addr: collection_addr
      }
    };

    // Correctly encode the message for cosmjs
    const msg = toUtf8(JSON.stringify(withdrawMsg));

    const wrapperMsg = {
      typeUrl: '/cosmwasm.wasm.v1.MsgExecuteContract',
      value: MsgExecuteContract.fromPartial({
        contract: `${process.env.NEXT_PUBLIC_STAKE_CONTRACT!}`,
        sender: wallet?.address, // The sender's address
        msg: msg, // The encoded execute message
      })
    };

    const totalGas = 3499999; // Adjust based on your contract's needs

    tx([wrapperMsg], { gas: totalGas }, () => {
      // Handle post-transaction logic. For example, navigating to another route
      router.push('/manage');
      setPoolAmount("0");
    });
  }, [
    wallet,
    tx, // Include tx if it's a prop or state
    router, // Include router if it's a prop or state
    // Add any other dependencies here
  ]);

  // Handler for enabling contract
  const handleEnableContract = () => {
    // Check if contract address is valid
    if (!contractAddress) {
      alert('Please enter a valid contract address.');
      return;
    }

    // Create and send ExecuteMsg for enabling contract
    const enableMsg = {
      addr: contractAddress,
      enabled: true,
    };
    console.log('Enable Msg:', enableMsg);
    // Send the enableMsg to the smart contract
  };


  // Handler for disabling contract
  const handleDisableContract = () => {
    // Check if contract address is valid
    if (!contractAddress) {
      alert('Please enter a valid contract address.');
      return;
    }

    // Create and send ExecuteMsg for disabling contract
    const disableMsg = {
      addr: contractAddress,
      enabled: false,
    };
    console.log('Disable Msg:', disableMsg);
    // Send the disableMsg to the smart contract
  };

  // Function to handle assigning NFTs to levels
  const handleAssignNFT = async () => {
    // Generate the rarityToLevelId mapping dynamically
    interface RarityToLevelIdMap {
      [key: string]: number;
    }

    const rarityToLevelId = rarities.reduce((acc: RarityToLevelIdMap, rarity, index) => {
      acc[rarity] = index + 2; // Starts at level ID 2 for "Uncommon"
      return acc;
    }, {});

    const levelId = rarityToLevelId[selectedLevel];
    if (!levelId) {
      alert('Please select a valid level.');
      return;
    }

    // Trim off trailing commas and then split
    const cleanedInput = nftNumbers.replace(/,+$/, '').trim();
    const nftIdsArray = cleanedInput.split(',')
      .map(s => s.trim()) // Trim spaces around numbers
      .map(Number) // Convert strings to numbers
      .filter(n => !isNaN(n)); // Filter out any non-numbers

    if (nftIdsArray.length === 0) {
      alert('Please enter valid NFT token IDs.');
      return;
    }

    const collectionAddr = selectedCollectionAddress; // Make sure this is correctly set

    const executeMsg = {
      update_specific_level: {
        collection_addr: collectionAddr,
        level_id: levelId,
        new_value: nftIdsArray,
      },
    };

    // Correctly encode the message for cosmjs
    const msg = toUtf8(JSON.stringify(executeMsg));

    const wrapperMsg = {
      typeUrl: '/cosmwasm.wasm.v1.MsgExecuteContract',
      value: MsgExecuteContract.fromPartial({
        contract: `${process.env.NEXT_PUBLIC_STAKE_CONTRACT!}`,
        sender: wallet?.address, // The sender's address
        msg: msg, // The encoded execute message
      })
    };

    const totalGas = 3499999; // Adjust based on your contract's needs

    tx([wrapperMsg], { gas: totalGas }, () => {
      // Handle post-transaction logic. For example, navigating to another route
      router.push('/manage');
    });
  };


  // Function to handle assigning NFTs to levels
  const handleSetReward = async () => {

    const collectionAddr = selectedCollectionAddress; // Make sure this is correctly set
    const reward_amount = (Math.ceil(Number(rewardAmount) * 1000000)).toString();

    const executeMsg = {
      mod_reward: {
        addr: collectionAddr,
        reward: reward_amount
      },
    };

    // Correctly encode the message for cosmjs
    const msg = toUtf8(JSON.stringify(executeMsg));

    const wrapperMsg = {
      typeUrl: '/cosmwasm.wasm.v1.MsgExecuteContract',
      value: MsgExecuteContract.fromPartial({
        contract: `${process.env.NEXT_PUBLIC_STAKE_CONTRACT!}`,
        sender: wallet?.address, // The sender's address
        msg: msg, // The encoded execute message
      })
    };

    const totalGas = 1499999; // Adjust based on your contract's needs

    tx([wrapperMsg], { gas: totalGas }, () => {
      // Handle post-transaction logic. For example, navigating to another route
      router.push('/manage');
    });
  };

  // Function to handle change in the NFT numbers input field
  const handleNftNumbersChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Remove leading and trailing whitespaces and trailing comma
    let input = e.target.value.trim();
    // Validate input to allow only numbers and commas
    input = input.replace(/[^0-9,]/g, '');
    // Update state with sanitized input
    setNftNumbers(input);
  };

  // Function to handle change in the NFT numbers input field
  const handleSetRewardChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Remove leading and trailing whitespaces and trailing comma
    let input = e.target.value.trim();
    // Validate input to allow only numbers and commas
    input = input.replace(/[^0-9,]/g, '');
    // Update state with sanitized input
    setRewardAmount(input);
  };

  const handleTransaction = () => {
    // Ensure amount is parsed as a number and handle potential parsing errors
    const amountValue = parseFloat(amount);
    if (isNaN(amountValue)) {
      alert("Please enter a valid number for the amount.");
      return;
    }

    const collection = selectedCollectionAddress;
    localStorage.setItem('selectedCollectionAddress', selectedCollectionAddress);

    if (transactionType === 'Deposit') {
      handleDeposit(amountValue, collection);
    } else if (transactionType === 'Withdraw') {

      handleWithdraw(collection);
    } else {
      return;
    }
  };


  return (
    <div className="container mx-auto px-4 sm:px-8 max-w-3xl">
      <div className="py-8">
        {/* Staking Reward Tokens */}
        <div className="mb-6 bg-white shadow rounded-lg p-4 sm:p-6 xl:p-8">
          <div className="mb-4 flex justify-between items-center">
            <h3 className="text-xl font-bold leading-none text-gray-900">Staking Reward Tokens</h3>
          </div>
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-grow mb-4 md:mb-0">
              <select
                className="border border-gray-300 text-gray-900 sm:text-sm rounded-lg block w-full p-2.5 min-w-[120px]"
                value={transactionType}
                onChange={(e) => setTransactionType(e.target.value)}
              >
                <option value="Deposit">Deposit</option>
                <option value="Withdraw">Withdraw</option>
              </select>
            </div>
            <div className="flex-grow mb-4 md:mb-0">
              <select
                className="border border-gray-300 text-gray-900 sm:text-sm rounded-lg block w-full p-2.5 min-w-[150px]"
                value={selectedCollectionAddress}
                onChange={(e) => setSelectedCollectionAddress(e.target.value)}
              >
                {collectionAddresses.map((addr, index) => (
                  <option key={index} value={addr}>
                    {`${addr.substring(0, 5)}...${addr.substring(addr.length - 4)}`}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-grow">
              {transactionType === 'Deposit' ? (
                <input
                  className="border border-gray-300 text-gray-900 sm:text-sm rounded-lg block w-full p-2.5"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                />
              ) : (
                <div className="flex border border-gray-300 text-gray-900 sm:text-sm rounded-lg block w-full p-2.5 items-center justify-between min-w-[150px]">
                  <span>Tokens: </span>
                  <span>{parseFloat(poolAmount).toLocaleString(undefined, { maximumFractionDigits: 3 })}</span>
                </div>
              )}
            </div>
            <div className="flex-grow">
              <button
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-full min-w-[150px]"
                onClick={handleTransaction}
              >
                {transactionType === 'Deposit' ? 'Send' : 'Receive'}
              </button>
            </div>
          </div>
        </div>


        {/* Enable/Disable Collection 
        <div className="mb-6 bg-white shadow rounded-lg p-4 sm:p-6 xl:p-8 ">
          <div className="mb-4 flex justify-between items-center">
            <h3 className="text-xl font-bold leading-none text-gray-900">Enable/Disable Collection</h3>
          </div>
          <div className="mb-4">
            <label className="block mb-1 text-sm font-medium text-gray-700">Collection Address:</label>
            <input
              type="text"
              className="border border-gray-300 text-gray-900 sm:text-sm rounded-lg block w-full p-2.5"
              value={contractAddress}
              onChange={(e) => setContractAddress(e.target.value)}
              placeholder="Enter address"
            />
          </div>
          <div className="flex justify-start gap-4">
            <button className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded">
              Enable Collection
            </button>
            <button className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded">
              Disable Collection
            </button>
          </div>
        </div> */}


        {/* Set the reward for multiplier 1x */}
        <div className="py-8">
          <div className="bg-white shadow rounded-lg p-4 sm:p-6 xl:p-8 ">
            <div className="mb-4 flex justify-between items-center">
              <h3 className="text-xl font-bold leading-none text-gray-900">Set Minimum Reward</h3>
            </div>
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <input
                type="text"
                className="border border-gray-300 text-gray-900 sm:text-sm rounded-lg block w-full p-2.5 max-w-[250px]"
                value={rewardAmount}
                onChange={handleSetRewardChange}
                placeholder="0"
              />
              <div className="flex-grow mb-4 md:mb-0">
                <select
                  className="border border-gray-300 text-gray-900 sm:text-sm rounded-lg block w-full p-2.5 max-w-[250px]"
                  value={selectedCollectionAddress}
                  onChange={(e) => setSelectedCollectionAddress(e.target.value)}
                >
                  {collectionAddresses.map((addr, index) => (
                    <option key={index} value={addr}>
                      {`${addr.substring(0, 5)}...${addr.substring(addr.length - 4)}`}
                    </option>
                  ))}
                </select>
              </div>

              <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded min-w-[150px]" onClick={handleSetReward}>
                Set
              </button>
            </div>
          </div>
        </div>

        {/* Assign NFT to Levels */}
        <div className="py-8">
          <div className="bg-white shadow rounded-lg p-4 sm:p-6 xl:p-8 ">
            <div className="mb-4 flex justify-between items-center">
              <h3 className="text-xl font-bold leading-none text-gray-900">Assign NFT to Levels</h3>
            </div>
            <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="mb-4 md:mb-0">
                <label className="block mb-1 text-sm font-medium text-gray-700">Level:</label>
                <select
                  className="border border-gray-300 text-gray-900 sm:text-sm rounded-lg block w-full p-2.5"
                  value={selectedLevel}
                  onChange={(e) => setSelectedLevel(e.target.value)}
                >
                  <option value="">Select Rarity</option>
                  {rarities.map((rarity, index) => (
                    <option key={rarity} value={rarity}>
                      {rarity}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">NFT Token IDs:</label>
                <input
                  type="text"
                  className="border border-gray-300 text-gray-900 sm:text-sm rounded-lg block w-full p-2.5"
                  value={nftNumbers}
                  onChange={handleNftNumbersChange}
                  placeholder="Enter IDs"
                />
              </div>
            </div>
            <div className="flex justify-start">
              <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded" onClick={handleAssignNFT}>
                Assign NFT
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

}

export default IndexPage;
