import { Header, MediaView, LogoSpinner, Empty } from 'components'
import React, { useCallback, useState, useEffect, useMemo } from 'react'
import { useStargazeClient, useWallet } from 'client'
import copy from 'copy-to-clipboard'
import { queryClubInventory } from 'client/query'
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

  const { client } = useStargazeClient()

  const toaster = useToaster()
  const router = useRouter()

  const { peer: queryPeer, offer: queryOfferedNfts } = router.query


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
      queryClubInventory(peerAddress).then((inventory) => {
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



  const handleInventoryItemClick = useCallback(
    (nft: Media) => {

    },
    [currentTab],
  )

  useEffect(() => {
    if (wallet) {
      setIsLoadingUserNfts(true)
      queryClubInventory(wallet?.address).then((inventory) => {
        setUserNfts(inventory)
        setIsLoadingUserNfts(false)
      })
    }
  }, [wallet])


  return (
    <main>
      <div className="flex flex-col space-y-2 lg:items-center lg:space-y-0 lg:flex-row lg:justify-between">
        <Header>BASE NFTs - Stake & Earn</Header>
      </div>
      <div className="grid grid-cols-1 gap-8 mt-3 mb-4 lg:mb-0 lg:mt-4 2xl:mt-6">
        <div>

            <p className="text-xl font-medium">NFT Staking Club</p>
            <p className="font-medium text-white/75">
              Who's staking right now?
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

      </div>
    </main>
  )
}

export default Trade
