import { Bytes, JSONValueKind, ipfs, json, log } from '@graphprotocol/graph-ts'
import {
  Contract,
  Approval,
  ApprovalForAll,
  OwnershipTransferred,
  Transfer as TransferEvent
} from "../generated/Contract/Contract"
// import { ExampleEntity } from "../generated/schema"
import { getOrCreateAccount } from './entities/account'
import { integer, ADDRESS_ZERO } from '@protofire/subgraph-toolkit'
import { Artwork } from '../generated/schema'
import { getIpfsHash } from './helpers'

export function handleApproval(event: Approval): void {
  // Entities can be loaded from the store using a string ID; this ID
  // needs to be unique across all entities of the same type

  // let entity = ExampleEntity.load(event.transaction.from.toHex())

  // // Entities only exist after they have been saved to the store;
  // // `null` checks allow to create entities on demand
  // if (entity == null) {
  //   entity = new ExampleEntity(event.transaction.from.toHex())

  //   // Entity fields can be set using simple assignments
  //   entity.count = BigInt.fromI32(0)
  // }

  // // BigInt and BigDecimal math are supported
  // entity.count = entity.count + BigInt.fromI32(1)

  // // Entity fields can be set based on event parameters
  // entity.owner = event.params.owner
  // entity.approved = event.params.approved

  // // Entities can be written to the store with `.save()`
  // entity.save()

  // Note: If a handler doesn't require existing field values, it is faster
  // _not_ to load the entity from the store. Instead, create it fresh with
  // `new Entity(...)`, set the fields that should be updated and save the
  // entity back to the store. Fields that were not set or unset remain
  // unchanged, allowing for partial updates to be applied.

  // It is also possible to access smart contracts from mappings. For
  // example, the contract that has emitted the event can be connected to
  // with:
  //
  // let contract = Contract.bind(event.address)
  //
  // The following functions can then be called on this contract to access
  // state variables and other data:
  //
  // - contract.balanceOf(...)
  // - contract.baseURI(...)
  // - contract.currentBidDetailsOfToken(...)
  // - contract.getApproved(...)
  // - contract.isApprovedForAll(...)
  // - contract.isWhitelisted(...)
  // - contract.name(...)
  // - contract.owner(...)
  // - contract.ownerOf(...)
  // - contract.supportsInterface(...)
  // - contract.symbol(...)
  // - contract.tokenByIndex(...)
  // - contract.tokenOfOwnerByIndex(...)
  // - contract.tokenPrice(...)
  // - contract.tokenURI(...)
  // - contract.totalSupply(...)
}

export function handleApprovalForAll(event: ApprovalForAll): void {}

export function handleOwnershipTransferred(event: OwnershipTransferred): void {}

export function handleTransfer(event: TransferEvent): void {
  let account = getOrCreateAccount(event.params.to)
  let tokenId = event.params.tokenId.toString()

  if (event.params.from.toHex() == ADDRESS_ZERO) {
    // Mint token
    let item = new Artwork(tokenId)
    item.creator = account.id
    item.owner = item.creator
    item.tokenId = event.params.tokenId
    item.creationDate = event.block.timestamp
    let uri = Contract.bind(event.address).tokenURI(event.params.tokenId)

    if (!!uri) {
      item.metadataUri = uri 
      item.broken = false
    } else {
      item.broken = true
    }

    readArtworkMetadata(item as Artwork).save()

    item.save()

  } else {

    let item = Artwork.load(tokenId)

    if (item != null) {
      if (event.params.to.toHex() == ADDRESS_ZERO) {
        // Burn token
        // item.removed = event.block.timestamp
      } else {
        // Transfer token
        item.owner = account.id
        item.modified = event.block.timestamp
      }

      item.save()
    } else {
      log.warning('Artwork #{} not exists', [tokenId])
    }
  }


}

function readArtworkMetadata(item: Artwork): Artwork {
  let hash = getIpfsHash(item.metadataUri)
  if (hash != null) {
    item.mediaUri = hash 

    let raw = ipfs.cat(hash)

    item.metadataHash = hash

    if (raw != null) {
      let value = json.fromBytes(raw as Bytes)

      if (value.kind == JSONValueKind.OBJECT) {
        let data = value.toObject()

        if (data.isSet('name')) {
          item.name = data.get('name').toString()
        }

        if (data.isSet('description')) {
          item.description = data.get('description').toString()
        }

        if (data.isSet('creationDate')) {
          item.creationDate = data.get('creationDate').toBigInt()
        }

        if (data.isSet('image')) {
          item.mediaUri = data.get('image').toString()
          item.mediaHash = getIpfsHash(item.mediaUri)
        }

        if (data.isSet('animation_url')) {
          item.mediaUri = data.get('animation_url').toString()
          item.mediaHash = getIpfsHash(item.mediaUri)
        }

        if (data.isSet('media')) {

          let media = data.get('media').toObject()

          if (media.isSet('mimeType')) {
            item.mimeType = media.get('mimeType').toString()
          }

          if (media.isSet('size')) {
            item.size = media.get('size').toBigInt()
          }

        }

        if (data.isSet('tags')) {
          item.tags = data
            .get('tags')
            .toArray()
            .map<string>(t => t.toString())
        }

      }
    }
  } else {
    item.broken = true
  }

  return item
}
