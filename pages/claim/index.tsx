import { Header, MediaView, LogoSpinner, Empty } from 'components'
import React, { useCallback, useState, useEffect, useMemo } from 'react'
import { useStargazeClient, useWallet } from 'client'
import copy from 'copy-to-clipboard'
import { queryClaimInventory } from 'client/query'
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

function none() {}
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

const Trade = () => {
  const { wallet } = useWallet()
  const { tx } = useTx()
  const { client } = useStargazeClient()

  const toaster = useToaster()
  const router = useRouter()

  const { peer: queryPeer, offer: queryOfferedNfts } = router.query

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
      queryClaimInventory(peerAddress).then((inventory) => {
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
      queryClaimInventory(wallet?.address).then((inventory) => {
        setUserNfts(inventory)
        setIsLoadingUserNfts(false)
      })
    }
  }, [wallet])

  const handleClaimRewards = useCallback(async () => {
    if (!userNfts || userNfts.length === 0) return;
  
    const claimMsgs = userNfts
      .filter((nft) => selectedUserNfts.has(getNftMod(nft)))
      .map((nft) => {
        const claimMsg = {
          claim_reward_by_token_id: {
            collection_addr: nft.collection.contractAddress, // Assuming this is where the collection address is stored
            token_id: nft.tokenId.toString(),
          }
        };
  
        return {
          typeUrl: '/cosmwasm.wasm.v1.MsgExecuteContract',
          value: MsgExecuteContract.fromPartial({
            sender: wallet?.address,
            msg: toUtf8(JSON.stringify(claimMsg)),
            contract: "terra1leqsj8gvgxnasav5ed5lens8j2cq3p0e5qwgulxkqwxqcngetf4qdrhg4l"
          })
        };
      });

    tx(claimMsgs, { gas: 1499999 }, () => {
      router.push('/claim')
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

            <p className="text-xl font-medium">NFTs with Rewards</p>
            <p className="font-medium text-white/75">
              Earned by Staking...
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
            <p className="text-xl font-medium">Claim Staking Rewards</p>
            <p className="font-medium text-white/75">
              After vesting period...
            </p>
            <div className="lg:h-[69vh] mt-4">
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
          <button
            onClick={handleClaimRewards}
            className="inline-flex items-center justify-center w-full h-10 px-16 py-4 text-sm font-medium text-white rounded-lg bg-primary hover:bg-primary-500"
          >
            Claim Selected Rewards
          </button>
        </div>
      </div>
    </main>
  )
}

export default Trade
