
const { ethers, network } = require('hardhat')
const delegations = require('../delegations.js')
const helpers = require("@nomicfoundation/hardhat-network-helpers");


/**
 * Script:
 * Sign delegations
 * Connect to provider from regular address
 * Then, for each address that we need to delegate to
 * Iterate over the Ledger accounts and sign a delegateBySig to the address of the delegate
 * Submit that tx from the Unlock account
 * Once all done, transfer tokens to each of the addresses (if needed)
 */

const ABI = [{ "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "delegator", "type": "address" }, { "indexed": true, "internalType": "bytes32", "name": "id", "type": "bytes32" }, { "indexed": true, "internalType": "address", "name": "delegate", "type": "address" }], "name": "ClearDelegate", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "delegator", "type": "address" }, { "indexed": true, "internalType": "bytes32", "name": "id", "type": "bytes32" }, { "indexed": true, "internalType": "address", "name": "delegate", "type": "address" }], "name": "SetDelegate", "type": "event" }, { "inputs": [{ "internalType": "bytes32", "name": "id", "type": "bytes32" }], "name": "clearDelegate", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "", "type": "address" }, { "internalType": "bytes32", "name": "", "type": "bytes32" }], "name": "delegation", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "bytes32", "name": "id", "type": "bytes32" }, { "internalType": "address", "name": "delegate", "type": "address" }], "name": "setDelegate", "outputs": [], "stateMutability": "nonpayable", "type": "function" }]

const run = async () => {
  const provider = ethers.provider  //new ethers.providers.JsonRpcProvider(rpc)
  const snapshotDelegation = new ethers.Contract("0x469788fe6e9e9681c6ebf3bf78e7fd26fc015446", ABI, provider)

  // For each delegator, we check the state of things
  const delegators = Object.keys(delegations)
  for (let i = 0; i < delegators.length; i++) {
    console.group(`Delegator ${i} of ${delegators.length}`)
    // For each of the delegate, let's snapshot delegate!
    const delegator = delegators[i]
    const delegatee = delegations[delegator]

    const currentDelegate = await snapshotDelegation.delegation(delegator, ethers.utils.formatBytes32String('unlock-protocol.eth'))

    console.info(`${delegator} delegates to ${currentDelegate}`)

    if (currentDelegate.toLowerCase() !== delegatee.toLowerCase()) {
      console.info(`⚠️ The current delegate for ${delegator} is ${currentDelegate} and does not match the expected delegate ${delegatee}`)

      let signer
      if (network.name === 'localhost') {
        console.info('This is running in a forked network.')

        await helpers.impersonateAccount(delegator);
        await helpers.setBalance(delegator, 10n ** 18n);
        signer = await ethers.getSigner(delegator);

      } else {
        if (!process.env.MNEMONIC) {
          console.error(`⚠️ No process.env.MNEMONIC provided!`)
          return
        }
        // we run the real one!
        const path = "m/44'/60'/0'/0/" + i
        signer = new ethers.Wallet.fromMnemonic(process.env.MNEMONIC, path).connect(provider)

        if ((await signer.getAddress()).toLowerCase() !== delegator.toLowerCase()) {
          console.error(`⚠️ Signer ${signer.address} is not delegator ${delegator}!`)
          return
        }
      }
      const tx = await snapshotDelegation.connect(signer).setDelegate(ethers.utils.formatBytes32String('unlock-protocol.eth'), delegatee)
      console.log(`Transaction to set delegate from ${signer.address} to ${delegatee} sent ${tx.hash}`)
    }
    console.groupEnd()
  }
}

run()
