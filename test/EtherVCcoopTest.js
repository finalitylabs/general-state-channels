'use strict'

// Bi-direction Ether Payment Channel Tests

import MerkleTree from './helpers/MerkleTree'

const MultiSig = artifacts.require("./MultiSig.sol")
const Registry = artifacts.require("./CTFRegistry.sol")
const MetaChannel = artifacts.require("./MetaChannel.sol")

// Interpreters / Extension
const VirtualChannel = artifacts.require("./LibVirtualEthChannel.sol")
const EtherExtension = artifacts.require("./EtherExtension.sol")

const Utils = require('./helpers/utils')
const ethutil = require('ethereumjs-util')

// State
let reg
let msig_AI
let msig_BI

let ethExtInst
let ethExtAddress

let partyI // Ingrid hub
let partyA
let partyB

let subchannelRootHash_AI
let subchannelRootHash_BI

// channel code
let metachannel_AI
let metachannel_BI
let metaChannelBytecode_AI
let metaChannelBytecode_BI

let metachannelCTFaddress_AI
let metachannelCTFaddress_BI

// library addresses
let virtualchannel
let virtualchanneladdress

// sig storage
let metachannelCTFsig_AI_A
let metachannelCTFsig_AI_I

let metachannelCTFsig_BI_B
let metachannelCTFsig_BI_I

let s0sigA_AI
let s0sigI_AI
let s0sigB_BI
let s0sigI_BI

let s1sigA_AI
let s1sigI_AI
let s1sigB_BI
let s1sigI_BI

let s2sigA_AI
let s2sigI_AI
let s2sigB_BI
let s2sigI_BI

let s3sigA
let s3sigB

let ss1SigA
let ss1SigB
let ss2SigA
let ss2SigB

// state storage AI
let metaCTF_AI
let s0_AI
let s0marshall_AI
let s1_AI
let s1marshall_AI
let s2_AI
let s2marshall_AI
let s3_AI
let s3marshall_AI

// state storage BI
let metaCTF_BI
let s0_BI
let s0marshall_BI
let s1_BI
let s1marshall_BI
let s2_BI
let s2marshall_BI
let s3_BI
let s3marshall_BI

// payment sub channel state storage
let roothash_AI
let roothash_BI

let ethChannelID
let ss0_AI
let ss0_BI

let ss0marshall_AI
let ss0marshall_BI

let ss1
let ss1marshall
let ss2
let ss2marshall



contract('Test Virtual Channel Payments Hub', function(accounts) {

  before(async () => {
    partyA = accounts[1]
    partyB = accounts[2]
    partyI = accounts[3]

    reg = await Registry.new()
    virtualchannel = await VirtualChannel.new()
    virtualchanneladdress = virtualchannel.address
    ethExtInst = await EtherExtension.new()
    ethExtAddress = ethExtInst.address
  })

  // A->I ledger channel

  it("counterfactually instantiate meta-channel AI", async () => {
    // TODO: Use web3 to get predeployed bytecode with appended constructor args
    // TODO: add salt to args so metachannels become unique between same participants
    var args = [reg.address, partyA, partyI]
    var signers = [partyA, partyI]

    metachannel_AI = await MetaChannel.new(reg.address, partyA, partyI)
    metaCTF_AI = await Utils.getCTFstate(metachannel_AI.constructor.bytecode, signers, args)
    metachannelCTFaddress_AI = await Utils.getCTFaddress(metaCTF_AI)
  })

  it("Alice and Ingrid sign metachannel ctf code, store sigs", async () => {
    metachannelCTFsig_AI_A = await web3.eth.sign(partyA, metachannelCTFaddress_AI)
    metachannelCTFsig_AI_I = await web3.eth.sign(partyI, metachannelCTFaddress_AI)
  })

  it("deploy Alice and Ingrid MultiSig", async () => {
    msig_AI = await MultiSig.new(metachannelCTFaddress_AI, reg.address)
  })

  it("generate ether agreement state AI", async () => {
    var inputs = []
    inputs.push(0) // is close
    inputs.push(0) // sequence
    inputs.push(partyA) // partyA address
    inputs.push(partyI) // partyB address
    inputs.push(metachannelCTFaddress_AI) // counterfactual metachannel address
    inputs.push('0x0') // sub-channel root hash
    inputs.push(web3.toWei(10, 'ether')) // balance in ether partyA
    inputs.push(web3.toWei(10, 'ether')) // balance in ether partyB

    s0_AI = inputs
    s0marshall_AI = Utils.marshallState(inputs)
  })

  it("partyA signs state and opens msig agreement", async () => {
    s0sigA_AI = await web3.eth.sign(partyA, web3.sha3(s0marshall_AI, {encoding: 'hex'}))
    var r = s0sigA_AI.substr(0,66)
    var s = "0x" + s0sigA_AI.substr(66,64)
    var v = parseInt(s0sigA_AI.substr(130, 2)) + 27

    var receipt = await msig_AI.openAgreement(s0marshall_AI, ethExtAddress, v, r, s, {from: accounts[1], value: web3.toWei(10, 'ether')})
    var gasUsed = receipt.receipt.gasUsed
    //console.log('Gas Used: ' + gasUsed)
    
  })

  it("Ingrid signs state and joins msig agreement", async () => {
    s0sigI_AI = await web3.eth.sign(partyI, web3.sha3(s0marshall_AI, {encoding: 'hex'}))
    var r = s0sigI_AI.substr(0,66)
    var s = "0x" + s0sigI_AI.substr(66,64)
    var v = parseInt(s0sigI_AI.substr(130, 2)) + 27

    var receipt = await msig_AI.joinAgreement(s0marshall_AI, ethExtAddress, v, r, s, {from: accounts[3], value: web3.toWei(10, 'ether')})
    var gasUsed = receipt.receipt.gasUsed
    //console.log('Gas Used: ' + gasUsed)
  })

  // B->I Ledger channel

  it("counterfactually instantiate meta-channel BI", async () => {
    // TODO: Use web3 to get predeployed bytecode with appended constructor args
    // TODO: add salt to args so metachannels become unique between same participants
    var args = [reg.address, partyB, partyI]
    var signers = [partyB, partyI]

    metachannel_BI = await MetaChannel.new(reg.address, partyB, partyI)
    metaCTF_BI = await Utils.getCTFstate(metachannel_BI.constructor.bytecode, signers, args)
    metachannelCTFaddress_BI = await Utils.getCTFaddress(metaCTF_BI)
  })

  it("Bob and Ingrid sign metachannel ctf code, store sigs", async () => {
    metachannelCTFsig_BI_B = await web3.eth.sign(partyB, metachannelCTFaddress_BI)
    metachannelCTFsig_BI_I = await web3.eth.sign(partyI, metachannelCTFaddress_BI)
  })

  it("deploy Bob and Ingrid MultiSig", async () => {
    msig_BI = await MultiSig.new(metachannelCTFaddress_BI, reg.address)
  })

  it("generate ether agreement state BI", async () => {
    var inputs = []
    inputs.push(0) // is close
    inputs.push(0) // sequence
    inputs.push(partyB) // partyB address
    inputs.push(partyI) // partyI address
    inputs.push(metachannelCTFaddress_BI) // counterfactual metachannel address
    inputs.push('0x0') // sub-channel root hash
    inputs.push(web3.toWei(20, 'ether')) // balance in ether partyB
    inputs.push(web3.toWei(20, 'ether')) // balance in ether partyI

    s0_BI = inputs
    s0marshall_BI = Utils.marshallState(inputs)
  })

  it("partyB signs state and opens msig agreement", async () => {
    s0sigB_BI = await web3.eth.sign(partyB, web3.sha3(s0marshall_BI, {encoding: 'hex'}))
    var r = s0sigB_BI.substr(0,66)
    var s = "0x" + s0sigB_BI.substr(66,64)
    var v = parseInt(s0sigB_BI.substr(130, 2)) + 27

    var receipt = await msig_BI.openAgreement(s0marshall_BI, ethExtAddress, v, r, s, {from: accounts[2], value: web3.toWei(20, 'ether')})
    var gasUsed = receipt.receipt.gasUsed
    //console.log('Gas Used: ' + gasUsed)
    
  })

  it("Ingrid signs state and joins msig agreement with party B", async () => {
    s0sigI_BI = await web3.eth.sign(partyI, web3.sha3(s0marshall_BI, {encoding: 'hex'}))
    var r = s0sigI_BI.substr(0,66)
    var s = "0x" + s0sigI_BI.substr(66,64)
    var v = parseInt(s0sigI_BI.substr(130, 2)) + 27

    var receipt = await msig_BI.joinAgreement(s0marshall_BI, ethExtAddress, v, r, s, {from: accounts[3], value: web3.toWei(20, 'ether')})
    var gasUsed = receipt.receipt.gasUsed
    //console.log('Gas Used: ' + gasUsed)
  })

  it("generate virtual payment channel state AI", async () => {
    ethChannelID = web3.sha3('randomsalt2')
    // Since channels are now library logic, we can resuse deploys between channels
    // We probably don't need to counterfactually instantiate a lib for every channel
    var subchannelInputs = []
    subchannelInputs.push(0) // is close
    subchannelInputs.push(1) // is force push channel
    subchannelInputs.push(0) // subchannel sequence
    subchannelInputs.push(0) // timeout length ms
    subchannelInputs.push(virtualchanneladdress) // ether payment interpreter library address
    subchannelInputs.push(ethChannelID) // ID of subchannel
    subchannelInputs.push(metachannelCTFaddress_AI) // counterfactual metachannel address
    subchannelInputs.push(reg.address) // CTF registry address
    subchannelInputs.push('0x0') // subchannel tx roothash
    subchannelInputs.push(partyA) // partyA in the subchannel
    subchannelInputs.push(partyB) // partyB in the subchannel
    subchannelInputs.push(partyI) // Ingrid bond in the subchannel
    subchannelInputs.push(web3.toWei(5, 'ether')) // balance of party A in subchannel (ether)
    subchannelInputs.push(web3.toWei(10, 'ether')) // balance of party I in subchannel (ether)
    subchannelInputs.push(web3.toWei(5, 'ether')) // bond from ingrid

    ss0_AI = subchannelInputs
    ss0marshall_AI = Utils.marshallState(subchannelInputs)
    
    var hash = web3.sha3(ss0marshall_AI, {encoding: 'hex'})
    var buf = Utils.hexToBuffer(hash)
    var elems = []
    elems.push(buf)
    var merkle = new MerkleTree(elems)

    subchannelRootHash_AI = Utils.bufferToHex(merkle.getRoot())

    //console.log(merkle.root())

    var inputs = []
    inputs.push(0) // is close
    inputs.push(1) // sequence
    inputs.push(partyA) // partyA address
    inputs.push(partyI) // partyI address
    inputs.push(metachannelCTFaddress_AI) // counterfactual metachannel address
    inputs.push(subchannelRootHash_AI) // sub-channel root hash
    inputs.push(web3.toWei(10, 'ether')) // balance in ether partyA
    inputs.push(web3.toWei(20, 'ether')) // balance in ether partyB

    s1_AI = inputs
    s1marshall_AI = Utils.marshallState(inputs)
  })

  it("Alice signs state: s1... Ingrid waiting to receive bobs s1 state sig on his channel", async () => {
    s1sigA_AI = await web3.eth.sign(partyA, web3.sha3(s1marshall_AI, {encoding: 'hex'}))
  })

  it("generate virtual payment channel state BI", async () => {
    ethChannelID = web3.sha3('randomsalt1')
    // Since channels are now library logic, we can resuse deploys between channels
    // We probably don't need to counterfactually instantiate a lib for every channel
    var subchannelInputs = []
    subchannelInputs.push(0) // is close
    subchannelInputs.push(1) // is force push channel
    subchannelInputs.push(0) // subchannel sequence
    subchannelInputs.push(0) // timeout length ms
    subchannelInputs.push(virtualchanneladdress) // ether payment interpreter library address
    subchannelInputs.push(ethChannelID) // ID of subchannel
    subchannelInputs.push(metachannelCTFaddress_AI) // counterfactual metachannel address
    subchannelInputs.push(reg.address) // CTF registry address
    subchannelInputs.push('0x0') // subchannel tx roothash
    subchannelInputs.push(partyA) // partyA in the subchannel
    subchannelInputs.push(partyB) // partyB in the subchannel
    subchannelInputs.push(partyI) // Ingrid bond in the subchannel
    subchannelInputs.push(web3.toWei(5, 'ether')) // balance of party A in subchannel (ether)
    subchannelInputs.push(web3.toWei(10, 'ether')) // balance of party B in subchannel (ether)
    subchannelInputs.push(web3.toWei(10, 'ether')) // bond of ingrid (ether)

    ss0_BI = subchannelInputs
    ss0marshall_BI = Utils.marshallState(subchannelInputs)
    
    var hash = web3.sha3(ss0marshall_BI, {encoding: 'hex'})
    var buf = Utils.hexToBuffer(hash)
    var elems = []
    elems.push(buf)
    var merkle = new MerkleTree(elems)

    subchannelRootHash_BI = Utils.bufferToHex(merkle.getRoot())

    //console.log(merkle.root())

    var inputs = []
    inputs.push(0) // is close
    inputs.push(1) // sequence
    inputs.push(partyA) // partyA address
    inputs.push(partyI) // partyI address
    inputs.push(metachannelCTFaddress_BI) // counterfactual metachannel address
    inputs.push(subchannelRootHash_BI) // sub-channel root hash
    inputs.push(web3.toWei(10, 'ether')) // balance in ether partyA
    inputs.push(web3.toWei(20, 'ether')) // balance in ether partyB

    s1_BI = inputs
    s1marshall_BI = Utils.marshallState(inputs)
  })

  it("Bob signs state: s1... Ingrid may now sign respones to VC open state", async () => {
    s1sigB_BI = await web3.eth.sign(partyB, web3.sha3(s1marshall_BI, {encoding: 'hex'}))
  })

  it("Ingrid signs both open VC strings", async () => {
    s1sigI_BI = await web3.eth.sign(partyB, web3.sha3(s1marshall_BI, {encoding: 'hex'}))
    s1sigI_AI = await web3.eth.sign(partyB, web3.sha3(s1marshall_AI, {encoding: 'hex'}))
  })


  it("Ingrid sends signed open channel to both Alice and Bob", async () => {
  })

  it("generate ether VC channel payment", async () => {
    var subchannelInputs = []
    subchannelInputs.push(0) // is close
    subchannelInputs.push(1) // is force push channel
    subchannelInputs.push(1) // subchannel sequence
    subchannelInputs.push(0) // timeout length ms
    subchannelInputs.push(virtualchanneladdress) // ether payment interpreter library address
    subchannelInputs.push(ethChannelID) // ID of subchannel
    subchannelInputs.push(metachannelCTFaddress_AI) // counterfactual metachannel address Alice/Ingrid
    subchannelInputs.push(metachannelCTFaddress_BI) // counterfactual metachannel address Bob/Ingrid
    subchannelInputs.push(reg.address) // CTF registry address
    subchannelInputs.push('0x0') // subchannel tx roothash
    subchannelInputs.push(partyA) // partyA in the subchannel
    subchannelInputs.push(partyB) // partyB in the subchannel
    subchannelInputs.push(web3.toWei(6, 'ether')) // balance of party A in subchannel (ether)
    subchannelInputs.push(web3.toWei(9, 'ether')) // balance of party B in subchannel (ether)

    ss1 = subchannelInputs
    ss1marshall = Utils.marshallState(subchannelInputs)
    
  })

  it("both Alice and Bob sign state: s1 of virtual channel", async () => {
    ss1SigA = await web3.eth.sign(partyA, web3.sha3(ss1marshall, {encoding: 'hex'}))
    ss1SigB = await web3.eth.sign(partyB, web3.sha3(ss1marshall, {encoding: 'hex'}))
  })

  it("generate close VC channel state", async () => {
    var subchannelInputs = []
    subchannelInputs.push(1) // is close
    subchannelInputs.push(1) // is force push channel
    subchannelInputs.push(2) // subchannel sequence
    subchannelInputs.push(0) // timeout length ms
    subchannelInputs.push(virtualchanneladdress) // ether payment interpreter library address
    subchannelInputs.push(ethChannelID) // ID of subchannel
    subchannelInputs.push(metachannelCTFaddress_AI) // counterfactual metachannel address Alice/Ingrid
    subchannelInputs.push(metachannelCTFaddress_BI) // counterfactual metachannel address Bob/Ingrid
    subchannelInputs.push(reg.address) // CTF registry address
    subchannelInputs.push('0x0') // subchannel tx roothash
    subchannelInputs.push(partyA) // partyA in the subchannel
    subchannelInputs.push(partyB) // partyB in the subchannel
    subchannelInputs.push(web3.toWei(6, 'ether')) // balance of party A in subchannel (ether)
    subchannelInputs.push(web3.toWei(9, 'ether')) // balance of party B in subchannel (ether)

    ss2 = subchannelInputs
    ss2marshall = Utils.marshallState(subchannelInputs)
    
  })

  it("both parties sign state: s3", async () => {
    ss2SigA = await web3.eth.sign(partyA, web3.sha3(ss2marshall, {encoding: 'hex'}))
    ss2SigB = await web3.eth.sign(partyB, web3.sha3(ss2marshall, {encoding: 'hex'}))
  })

  it("Alice and Bob send their close signatures to Ingrid", async () => {

  })

  it("Ingrid generates updated agreement states based on the close agreement with Bob", async () => {
    var inputs = []
    inputs.push(0) // is close
    inputs.push(1) // sequence
    inputs.push(partyB) // partyA address
    inputs.push(partyI) // partyI address
    inputs.push(metachannelCTFaddress_BI) // counterfactual metachannel address
    inputs.push('0x0') // sub-channel root hash
    inputs.push(web3.toWei(11, 'ether')) // balance in ether partyA
    inputs.push(web3.toWei(19, 'ether')) // balance in ether partyB

    s2_BI = inputs
    s2marshall_BI = Utils.marshallState(inputs) 	
  })

  it("Ingrid generates updated agreement states based on the close agreement with Alice", async () => {
    var inputs = []
    inputs.push(0) // is close
    inputs.push(1) // sequence
    inputs.push(partyA) // partyA address
    inputs.push(partyI) // partyI address
    inputs.push(metachannelCTFaddress_AI) // counterfactual metachannel address
    inputs.push('0x0') // sub-channel root hash
    inputs.push(web3.toWei(11, 'ether')) // balance in ether partyA
    inputs.push(web3.toWei(19, 'ether')) // balance in ether partyB

    s2_AI = inputs
    s2marshall_AI = Utils.marshallState(inputs) 	
  })

  it("Ingrid signs both update agreement states", async () => {
    s2sigI_AI = await web3.eth.sign(partyI, web3.sha3(s2marshall_AI, {encoding: 'hex'}))
    s2sigI_BI = await web3.eth.sign(partyI, web3.sha3(s2marshall_BI, {encoding: 'hex'}))
  })

  it("Ingrid sends agreement state update to Alice and Bob, updated when signed", async () => {
    s2sigA_AI = await web3.eth.sign(partyA, web3.sha3(s2marshall_AI, {encoding: 'hex'}))
    s2sigB_BI = await web3.eth.sign(partyB, web3.sha3(s2marshall_BI, {encoding: 'hex'}))
  })

  // it("closes the channel", async () => {
  //   var r = s3sigA.substr(0,66)
  //   var s = "0x" + s3sigA.substr(66,64)
  //   var v = parseInt(s3sigA.substr(130, 2)) + 27

  //   var r2 = s3sigB.substr(0,66)
  //   var s2 = "0x" + s3sigB.substr(66,64)
  //   var v2 = parseInt(s3sigB.substr(130, 2)) + 27

  //   var sigV = []
  //   var sigR = []
  //   var sigS = []

  //   sigV.push(v)
  //   sigV.push(v2)
  //   sigR.push(r)
  //   sigR.push(r2)
  //   sigS.push(s)
  //   sigS.push(s2)

  //   var balA = await web3.fromWei(web3.eth.getBalance(accounts[1]), 'ether')
  //   var balB = await web3.fromWei(web3.eth.getBalance(accounts[2]), 'ether')
  //   //console.log('Balance A before close: ' + balA)
  //   //console.log('Balance B before close: ' + balB)

  //   var receipt = await msig.closeAgreement(s3marshall, sigV, sigR, sigS)
  //   var gasUsed = receipt.receipt.gasUsed
  //   //console.log('Gas Used: ' + gasUsed)

  //   balA = await web3.fromWei(web3.eth.getBalance(accounts[1]), 'ether')
  //   balB = await web3.fromWei(web3.eth.getBalance(accounts[2]), 'ether')
  //   //console.log('Balance A after close: ' + balA)
  //   //console.log('Balance B after close: ' + balB)
  // })
})