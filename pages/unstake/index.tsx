import { Header, MediaView, LogoSpinner, Empty } from 'components'
import React, { useCallback, useState, useEffect, useMemo } from 'react'
import { useStargazeClient, useWallet } from 'client'
import copy from 'copy-to-clipboard'
import { queryStakedInventory } from 'client/query'
import { Mod, Media, getNftMod } from 'util/type'
import { fromBech32, toUtf8 } from '@cosmjs/encoding'
import { useRouter } from 'next/router'
import { MsgExecuteContract } from 'cosmjs-types/cosmwasm/wasm/v1/tx'
import { CONTRACT_ADDRESS } from 'util/constants'
import { useTx } from 'contexts/tx'
import { ShortUrl } from '@prisma/client'
import useToaster, { ToastTypes } from 'hooks/useToaster'
import { classNames } from 'util/css'
import { fetchNfts } from 'util/nft'

enum SelectTarget {
  User,
  Peer,
}

type Tab = 'user' | 'peer'

const TabItem = ({
  id,
  name,
  current,
  handleClick,
}: {
  id: Tab
  name: string
  current: boolean
  handleClick: (name: Tab) => void
}) => (
  <a
    onClick={() => handleClick(id)}
    className={classNames(
      current ? 'bg-firefly-700' : 'bg-firefly hover:bg-firefly-800',
      'inline-flex py-2.5 px-2 cursor-pointer items-center justify-center w-full border rounded-md border-white/10',
    )}
  >
    <p className="text-base font-medium text-white">{name}</p>
  </a>
)

const tabs: {
  id: Tab
  name: string
}[] = [
    {
      id: 'user',
      name: 'Your NFT Inventory',
    },
  ]

function none() { }
const Inventory = ({
  nfts,
  handleClick,
  small,
  isLoading,
  input,
  inputPlaceholder,
  inputOnChange,
}: {
  nfts: Media[]
  handleClick: (nft: Media) => void
  small?: boolean
  isLoading: boolean
  input?: boolean
  inputPlaceholder?: string
  inputOnChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
}) => (
  <div className="h-full p-4 overflow-y-scroll border rounded-lg border-white/10">
    {isLoading ? (
      <div className="flex items-center justify-center h-full">
        <LogoSpinner />
      </div>
    ) : (
      <>
        {input && (
          <input
            className="border w-full bg-firefly mb-4 rounded-lg border-white/10 focus:ring focus:ring-primary ring-offset-firefly px-4 py-2.5 text-white"
            placeholder={inputPlaceholder}
            onChange={inputOnChange || none}
          />
        )}
        {nfts.length < 1 ? (
          <div className="flex items-center justify-center h-full">
            <Empty small={small} />
          </div>
        ) : (
          <div
            className={classNames(
              small ? 'lg:grid-cols-3 2xl:grid-cols-4' : '2xl:grid-cols-3',
              'grid grid-cols-2 gap-2',
            )}
          >
            {nfts.map((nft) => (
              <MediaView
                nft={nft}
                onClick={() => handleClick(nft)}
                selected={false}
                small={small}
              />
            ))}
          </div>
        )}
      </>
    )}
  </div>
)

const Unstake = () => {
  const { wallet } = useWallet()
  const { tx } = useTx()
  const { client } = useStargazeClient()

  const toaster = useToaster()
  const router = useRouter()

  const { peer: queryPeer, offer: queryOfferedNfts } = router.query

  let [unstakeFeeSelected, setUnstakeFeeSelected] = useState(''); // Define feeSelected state here

  // Function to handle stakeFeeSelected change
  const handleSetUnStakeFeeDenomination = (value: string) => {
    // Update state and store in local storage
    setUnstakeFeeSelected(value);
    localStorage.setItem('unstakeFeeSelected', value);
  };

  // Add useEffect to initialize stakeFeeSelected only once
  useEffect(() => {
    // Load stakeFeeSelected from local storage or any other persistent storage
    const storedUnStakeFeeSelected = localStorage.getItem('unstakeFeeSelected');
    if (storedUnStakeFeeSelected) {
      setUnstakeFeeSelected(storedUnStakeFeeSelected);
    }
  }, []);

  // Call onChange when the component mounts
  /*useEffect(() => {
    setFeeSelected(feeSelected); // Assuming feeSelected is the initial value of the dropdown
  }, []); // Empty dependency array ensures it runs only once when the component mounts*/

  // Querystring manipulation
  useEffect(() => {
    if (!queryPeer) return

    const peer = queryPeer as string

    if (!peer) return

    // If the peer is the user, remove it from the querystring
    if (peer === wallet?.address) router.push('/stake')

    // Is it a bech32 address?
    try {
      fromBech32(peer)
      setPeerAddress(peer)
      setCurrentTab('peer')
    } catch {
      // If not, maybe it's a shorturl?
      fetch('/api/shorturl?path=' + peer)
        .then((res) => {
          if (!res.ok) {
            // At this point we know it can't be an address, so we remove it
            router.push({ pathname: '/stake', query: {} })
          }
          return res.json()
        })
        .then((json) => {
          const peer = json.destination.replace('?peer=', '').split('&')[0]

          // If the peer is the user, remove it from the querystring
          if (peer === wallet?.address) router.push('/stake')

          // save the offer if it exists, if not don't include it
          let query = queryOfferedNfts
            ? {
              peer,
              offer: queryOfferedNfts,
            }
            : { peer }

          // If the shorturl exists, let's push it back as a bech32
          router.push({
            pathname: '/stake',
            query,
          })
        })
    }
  }, [queryPeer, wallet?.address])

  // Populate the selectedNfts if the `offer` querystring exists
  useEffect(() => {
    if (
      !client?.cosmWasmClient ||
      !queryPeer ||
      !queryOfferedNfts ||
      !wallet?.address
    )
      return
    const peer = queryPeer as string
    const offer = queryOfferedNfts as string

    if (!peer) return

    // Fetch nft data & select nfts
    try {
      fetchNfts(
        offer.split(',').map((nft) => {
          const [collection, token_id] = nft.split('-')
          return { collection, token_id: parseInt(token_id) }
        }),
        client,
      ).then((nfts) => {
        if (!nfts) return router.push('/stake')
        nfts.forEach((nft) => {
          console.log(getNftMod(nft))
          selectNft(SelectTarget.Peer, nft)
        })
      })
    } catch {
      router.push('/stake')
    }
  }, [client?.cosmWasmClient, queryPeer, queryOfferedNfts, wallet?.address])

  const [currentTab, setCurrentTab] = useState<Tab>('user')

  const [userNfts, setUserNfts] = useState<Media[]>()
  const [isLoadingUserNfts, setIsLoadingUserNfts] = useState<boolean>(false)

  const [peerNfts, setPeerNfts] = useState<Media[]>()
  const [isLoadingPeerNfts, setIsLoadingPeerNfts] = useState<boolean>(false)

  const [peerAddress, setPeerAddress] = useState<string>()
  useEffect(() => {
    selectedPeerNfts.clear()
    if (peerAddress) {
      setIsLoadingPeerNfts(true)
      queryStakedInventory(peerAddress).then((inventory) => {
        setPeerNfts(inventory)
        setIsLoadingPeerNfts(false)
      })
    }
  }, [peerAddress])

  const selectedUserNfts = useMemo(() => new Map<Mod, Media>(), [wallet])
  const [
    selectedUserNftsRefreshCounter,
    setSelectedUserNftsRefreshCounter,
  ] = useState<number>(0)
  const refreshSelectedUserNfts = useCallback(
    () => setSelectedUserNftsRefreshCounter(selectedUserNftsRefreshCounter + 1),
    [selectedUserNftsRefreshCounter, setSelectedUserNftsRefreshCounter],
  )

  const selectedPeerNfts = useMemo(() => new Map<Mod, Media>(), [wallet])
  const [
    selectedPeerNftsRefreshCounter,
    setSelectedPeerNftsRefreshCounter,
  ] = useState<number>(0)
  const refreshSelectedPeerNfts = useCallback(
    () => setSelectedPeerNftsRefreshCounter(selectedPeerNftsRefreshCounter + 1),
    [selectedPeerNftsRefreshCounter, setSelectedUserNftsRefreshCounter],
  )

  const inventoryNfts = useMemo(() => {
    switch (currentTab) {
      case 'user':
        return userNfts?.filter((nft) => !selectedUserNfts.has(getNftMod(nft)))
      case 'peer':
        return peerNfts?.filter((nft) => !selectedPeerNfts.has(getNftMod(nft)))
    }
  }, [
    currentTab,
    userNfts,
    peerNfts,
    selectedUserNfts,
    selectedPeerNfts,
    selectedUserNftsRefreshCounter,
    selectedPeerNftsRefreshCounter,
  ])

  const isLoadingCurrentTab = useMemo(() => {
    switch (currentTab) {
      case 'peer':
        return isLoadingPeerNfts
      case 'user':
        return isLoadingUserNfts
    }
  }, [currentTab, isLoadingPeerNfts, isLoadingUserNfts])

  const selectNft = (target: SelectTarget, nft: Media) => {
    switch (target) {
      case SelectTarget.User:
        switch (selectedUserNfts.has(getNftMod(nft))) {
          case true:
            selectedUserNfts.delete(getNftMod(nft))
            break
          case false:
            selectedUserNfts.set(getNftMod(nft), nft)
            break
        }
        refreshSelectedUserNfts()
        break
      case SelectTarget.Peer:
        switch (selectedPeerNfts.has(getNftMod(nft))) {
          case true:
            selectedPeerNfts.delete(getNftMod(nft))
            break
          case false:
            selectedPeerNfts.set(getNftMod(nft), nft)
            break
        }
        refreshSelectedPeerNfts()
        break
    }
  }

  const handleInventoryItemClick = useCallback(
    (nft: Media) => {
      let target: SelectTarget

      switch (currentTab) {
        case 'user':
          target = SelectTarget.User
          break
        case 'peer':
          target = SelectTarget.Peer
          break
      }

      if (selectedPeerNfts.has(getNftMod(nft))) target = SelectTarget.Peer
      if (selectedUserNfts.has(getNftMod(nft))) target = SelectTarget.User

      selectNft(target, nft)
    },
    [currentTab, selectNft],
  )

  useEffect(() => {
    if (wallet) {
      setIsLoadingUserNfts(true)
      queryStakedInventory(wallet?.address).then((inventory) => {
        setUserNfts(inventory)
        setIsLoadingUserNfts(false)
      })
    }
  }, [wallet])

  const handleUnstakeNfts = useCallback(async () => {
    if (!userNfts || userNfts.length === 0) return;

    const unstakeMsgs = userNfts
      .filter((nft) => selectedUserNfts.has(getNftMod(nft)))
      .map((nft) => {
        const unstakeMsg = {
          unstake_by_token_id: {
            collection_addr: nft.collection.contractAddress, // Assuming this is where the collection address is stored
            token_id: nft.tokenId.toString(),
          }
        };

        return {
          typeUrl: '/cosmwasm.wasm.v1.MsgExecuteContract',
          value: MsgExecuteContract.fromPartial({
            sender: wallet?.address,
            msg: toUtf8(JSON.stringify(unstakeMsg)),
            contract: "terra15rg0rm9x8qfjjgj6jwd0l9w9kdl8u3lsmwpjk2y4gx0hrafggfzqjv4p8j"
          })
        };
      });

    // Abort if there are not NFTs to Unstake  
    if (!unstakeMsgs || unstakeMsgs.length === 0) return;

    // Fee portion of the transaction
    const encoder = new TextEncoder();
    let encodedMsg = btoa(String.fromCharCode(...encoder.encode(JSON.stringify({ "pay_fee": { "collection_addr": "terra15rg0rm9x8qfjjgj6jwd0l9w9kdl8u3lsmwpjk2y4gx0hrafggfzqjv4p8j" } }))));

    let feeAmount = 0;
    let feeCw20Address = "";

    const unstakeFeeSelected = localStorage.getItem('unstakeFeeSelected');

    if (unstakeFeeSelected === "BASE") {
      feeCw20Address = "terra1uewxz67jhhhs2tj97pfm2egtk7zqxuhenm4y4m";
      feeAmount = Math.ceil(5 * 1000000 * unstakeMsgs.length);
    } else if (unstakeFeeSelected === "FROG") {
      feeCw20Address = "terra1wez9puj43v4s25vrex7cv3ut3w75w4h6j5e537sujyuxj0r5ne2qp9uwl9";
      feeAmount = Math.ceil(10 * 1000000 * unstakeMsgs.length);
    }

    const cw20FeeMsg = {
      send: {
        contract: "terra15rg0rm9x8qfjjgj6jwd0l9w9kdl8u3lsmwpjk2y4gx0hrafggfzqjv4p8j", //NFT Staking contract
        amount: feeAmount.toString(),
        msg: encodedMsg,
      }
    };

    // Include your CW20 token transaction as part of the stakeMsgs array
    const combinedMsg = {
      typeUrl: '/cosmwasm.wasm.v1.MsgExecuteContract',
      value: MsgExecuteContract.fromPartial({
        sender: wallet?.address,
        msg: toUtf8(JSON.stringify(cw20FeeMsg)),
        contract: feeCw20Address, //Fee Token
      })
    };

    // Add the CW20 fee message to the array of messages to be sent
    unstakeMsgs.push(combinedMsg);

    // Calculate the total gas based on the number of selected NFTs
    const totalGas = Math.ceil((unstakeMsgs.length - 1)) * 3499999; //one transaction is cw20

    tx(unstakeMsgs, { gas: totalGas }, () => {
      router.push('/stake')
    })
  }, [
    wallet,
    client,
    peerAddress,
    userNfts,
    peerNfts,
    selectedUserNfts,
    selectedPeerNfts,
  ])

  return (
    <main>
      <div className="flex flex-col space-y-2 lg:items-center lg:space-y-0 lg:flex-row lg:justify-between">
        <Header>Stake Frogztrik NFTs</Header>
      </div>
      <div className="grid grid-cols-1 gap-8 mt-3 mb-4 lg:mb-0 lg:mt-4 2xl:mt-6 lg:grid-cols-2">
        <div>

          <p className="text-xl font-medium">Your Staked NFTs</p>
          <p className="font-medium text-white/75">
            Located in Smart Contract...
          </p>

          <div className="lg:h-[75vh] mt-4">
            <Inventory
              isLoading={isLoadingCurrentTab}
              nfts={inventoryNfts || []}
              handleClick={handleInventoryItemClick}
              input={currentTab === 'peer'}
              inputPlaceholder="Enter peer address..."
              inputOnChange={(e) => {
                const address = e.currentTarget.value

                if (address === '') setPeerAddress(undefined)

                // Verify that the address is valid
                try {
                  fromBech32(address)
                } catch {
                  return
                }

                if (address === wallet?.address) {
                  return toaster.toast({
                    title: 'You cannot trade with yourself',
                    message:
                      'Enter an address that is not your own to view a peer inventory.',
                    type: ToastTypes.Warning,
                  })
                }

                setPeerAddress(address)
              }}
            />
          </div>
        </div>
        <div className="space-y-4 lg:grid grid-trade-custom lg:gap-4 lg:space-y-0">
          <div>
            <p className="text-xl font-medium">Selected NFTs</p>
            <p className="font-medium text-white/75">
              These NFTs will be unstaked...
            </p>
            <div className="lg:h-[66vh] mt-4">
              <Inventory
                isLoading={false}
                nfts={
                  userNfts?.filter((nft) =>
                    selectedUserNfts.has(getNftMod(nft)),
                  ) || []
                }
                handleClick={handleInventoryItemClick}
                small
              />
            </div>
          </div>
          <div className="lg:h-[4vh] flex flex-col items-center space-y-2 sm:flex-row sm:items-center sm:justify-center sm:space-x-8"
            style={{ marginTop: '10px', marginRight: '0px', marginBottom: '0px', marginLeft: '4px' }}>
          {/*<FeeDenomDropdown onChange={handleSetStakeFeeDenomination} />*/}
          <div className="flex items-center justify-center space-x-5 mt-2">
            <label htmlFor="fee-denomination" className="block text-sm font-medium text-white/75">
              Fee
            </label>
            <select
              id="fee-denomination"
              value={unstakeFeeSelected}
              onChange={(e) => handleSetUnStakeFeeDenomination(e.target.value)}
              className="w-32 border bg-firefly rounded-lg border-white/10 focus:ring focus:ring-primary ring-offset-firefly px-4 py-2.5 text-white"
            >
              <option value=""></option>
              <option value="FROG">10 FROG</option>
              <option value="BASE">5 BASE</option>
            </select>
          </div>
            <button
              onClick={handleUnstakeNfts}
              disabled={unstakeFeeSelected === ""}
              className={`flex items-center justify-center w-64 sm:px-24 py-4 text-sm font-medium text-white rounded-lg bg-primary hover:bg-primary-500 
                ${unstakeFeeSelected === "" ? 'opacity-50 cursor-not-allowed' : ''}`}
              style={{ marginTop: '10px', marginLeft: '32px' }}
            >
              Unstake
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}

export default Unstake
