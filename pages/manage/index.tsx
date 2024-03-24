import React, { useState } from 'react'
import { useStargazeClient, useWallet } from 'client'
import { fromBech32, toUtf8 } from '@cosmjs/encoding'
import { useRouter } from 'next/router'
import { MsgExecuteContract } from 'cosmjs-types/cosmwasm/wasm/v1/tx'
import useToaster, { ToastTypes } from 'hooks/useToaster'
import { useTx } from 'contexts/tx'

const IndexPage: React.FC = () => {
  const { wallet } = useWallet()
  const { tx } = useTx()
  const { client } = useStargazeClient()

  const toaster = useToaster()
  const router = useRouter()

  // State for staking reward tokens
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [withdrawAmount, setWithdrawAmount] = useState<number>(0);

  // State for enabling/disabling contract
  const [contractAddress, setContractAddress] = useState<string>('');

  const [selectedLevel, setSelectedLevel] = useState(''); // State to store selected level
  const [nftNumbers, setNftNumbers] = useState(''); // State to store NFT numbers


  // Handler for depositing reward tokens
  const handleDeposit = () => {
    // Check if deposit amount is valid
    if (isNaN(depositAmount) || depositAmount <= 0) {
      alert('Please enter a valid deposit amount.');
      return;
    }

    // Multiply deposit amount by 1,000,000 to convert to u128
    const u128Amount = depositAmount * 1000000;

    // Create and send ExecuteMsg for depositing reward
    const depositMsg = {
      collection_addr: 'YOUR_COLLECTION_ADDRESS_HERE', // Replace with actual address
      cw_balance: u128Amount,
    };
    console.log('Deposit Msg:', depositMsg);
    // Send the depositMsg to the smart contract
  };

  // Handler for withdrawing reward tokens
  const handleWithdraw = () => {
    // Check if withdraw amount is valid
    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      alert('Please enter a valid withdraw amount.');
      return;
    }

    // Create and send ExecuteMsg for withdrawing reward
    const withdrawMsg = {
      collection_addr: 'YOUR_COLLECTION_ADDRESS_HERE', // Replace with actual address
    };
    console.log('Withdraw Msg:', withdrawMsg);
    // Send the withdrawMsg to the smart contract
  };

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
    const handleAssignNFT = () => {
      // Your logic to handle assigning NFTs to levels
      console.log('Selected Level:', selectedLevel);
      console.log('NFT Numbers:', nftNumbers);
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

  return (
    <div className="p-8">
      {/* Staking reward tokens section */}
      <div className="mb-8">
        <h2 className="mb-4">Staking Reward Tokens</h2>
        <div className="mb-2 flex items-center">
          <label className="mr-2">Deposit Amount:</label>
          <input
            type="text"
            className="border rounded px-2 py-1 text-blue-900"
            value={depositAmount}
            onChange={(e) => setDepositAmount(parseFloat(e.target.value))}
          />
          <button className="ml-2 bg-blue-500 hover:bg-blue-700 text-white px-4 py-1 rounded" onClick={handleDeposit}>
            Deposit
          </button>
        </div>
        <div className="flex items-center">
          <label className="mr-2">Withdraw Amount:</label>
          <input
            type="text"
            className="border rounded px-2 py-1 text-blue-900"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(parseFloat(e.target.value))}
          />
          <button className="ml-2 bg-blue-500 hover:bg-blue-700 text-white px-4 py-1 rounded" onClick={handleWithdraw}>
            Withdraw
          </button>
        </div>
      </div>
      {/* Enable/Disable collection section */}
      <div>
        <h2 className="mb-4">Enable/Disable Collection</h2>
        <div className="mb-2 flex items-center">
          <label className="mr-2">Collection Address:</label>
          <input
            type="text"
            className="border rounded px-2 py-1 text-blue-900"
            value={contractAddress}
            onChange={(e) => setContractAddress(e.target.value)}
          />
        </div>
        <div>
          <button className="bg-green-500 hover:bg-green-700 text-white px-4 py-1 rounded mr-2" onClick={handleEnableContract}>
            Enable Collection
          </button>
          <button className="bg-red-500 hover:bg-red-700 text-white px-4 py-1 rounded" onClick={handleDisableContract}>
            Disable Collection
          </button>
        </div>
        {/* Assign NFT to Levels section */}
        <div>
          <h2 className="mb-4">Assign NFT to Levels</h2>
          <div className="mb-2 flex items-center">
            <label className="mr-2">Level:</label>
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="border rounded px-2 py-1 text-blue-900"
            >
              <option value="">Select Level</option>
              <option value="2">Level 2</option>
              <option value="3">Level 3</option>
              <option value="4">Level 4</option>
              <option value="5">Level 5</option>
              <option value="6">Level 6</option>
            </select>
          </div>
          <div className="mb-2 flex items-center">
            <label className="mr-2">NFT Token IDs:</label>
            <input
              type="text"
              className="border rounded px-2 py-1 text-blue-900"
              value={nftNumbers}
              onChange={handleNftNumbersChange}
            />
          </div>
          <button className="bg-blue-500 hover:bg-blue-700 text-white px-4 py-1 rounded" onClick={handleAssignNFT}>
            Assign NFT
          </button>
        </div>



      </div>
    </div>
  );
};

export default IndexPage;
