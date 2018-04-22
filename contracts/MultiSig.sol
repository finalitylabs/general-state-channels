pragma solidity ^0.4.18;

import "./ChannelRegistry.sol";
import "./MetaChannel.sol";
import "./lib/extensions/EtherExtension.sol";

/// @title SpankChain General-State-Channel - A multisignature "wallet" for general state
/// @author Nathan Ginnever - <ginneversource@gmail.com>

// TODO: Timeout on init deposit return

contract MultiSig {
    //using EtherExtension for EtherExtension;

    string public constant NAME = "General State MultiSig";
    string public constant VERSION = "0.0.1";

    ChannelRegistry public registry;

    // STATE
    //    32 isClose - Cooperative close flag
    //    64 sequence
    //    96 address 1
    //    128 address 2
    //    160 Meta Channel CTF address
    //    192 Sub-Channel Root Hash
    //    225 General State Sector Root Hash

    // General State Sectors - Extensions must be able to handle these format
    // Sectors represent the final state of channels.

    // Ether Balances - Sector type [0]
    //    EthBalanceA
    //    EthBalanceB
    //
    // Token Balances - Sector type [1]
    //    Token Address
    //    ERC20BalanceA
    //    ERC20BalanceB
    //
    // "Non-fungile" Objects - Sector type [2]
    //    Num721Objects
    //    721TokenID
    //    ...
    //
    // Battle Arena Fighter State - Sector type [3]
    //    wagerEthBalanceA - top level balance in Ether, may be 0
    //    wagerEthBalanceB
    //    wagerTokenAddress
    //    wagerTokenBalA
    //    wagerTokenBalB

    //    numFightersA - Start battle profile for A
    //    FighterStatsA1 - Record owner of cat here, make final agreements based on battles
    //    FighterStatsA2
    //    ...

    //    numFightersB - Start battle profile for B
    //    FighterStatsB1
    //    FighterStatsB2
    //    ...

    // Extension modules act on final state agreements from the sub-channel outcomes

    address public partyA;
    address public partyB;
    bytes32 metachannel; // Counterfactual address of metachannel
    bool[4] public extensionUsed; // ['ether', 'erc20', 'erc721'.  'ckba']

    uint256 bonded;

    bool isOpen = false; // true when both parties have joined

    function MultiSig(bytes32 _metachannel, address _registry) {
        require(_metachannel != 0x0);
        require(_registry != 0x0);
        metachannel = _metachannel;
        registry = ChannelRegistry(_registry);
    }

    function openAgreement(bytes _state, uint8 _ext, uint8 _v, bytes32 _r, bytes32 _s) public payable {
         // require the channel is not open yet
        require(isOpen == false);

        // check the account opening a channel signed the initial state
        address _initiator = _getSig(_state, _v, _r, _s);

        // Ether opening deposit
        if(_ext == 0) {
            // ensure the amount sent to open channel matches the signed state balance
            require(EtherExtension.getBalanceA(_state) == msg.value);
            // ensure the sender of funds is partyA.. not sure if this is a hard require
            require(EtherExtension.getPartyA(_state) == _initiator);
            // set bonded state for ether escrow
            bonded += msg.value;
            // Flag that this channel manages ether state
            extensionUsed[0] = true;
        }

        // ERC20 Token opening deposit
        if(_ext == 1) {}

        // ERC721 Object opening deposit
        if(_ext == 2) {}

        // CKBA Stats opening deposit
        if(_ext == 3) {}  
        
        // Set storage for state
        //state = _state;
        partyA = _initiator;
    }

    function joinAgreement(bytes _state, uint8 _ext, uint8 _v, bytes32 _r, bytes32 _s) public payable {
        // require the channel is not open yet
        require(isOpen == false);

        // check that the state is signed by the sender and sender is in the state
        address _joiningParty = _getSig(_state, _v, _r, _s);
        
        // Ether joining deposit
        if(_ext == 0) {
            // ensure the amount sent to join channel matches the signed state balance
            require(EtherExtension.getPartyB(_state) == _joiningParty);
            // ensure the sender of funds is partyA.. not sure if this is a hard require
            require(EtherExtension.getBalanceB(_state) == msg.value);
            bonded += msg.value;
            // Require bonded is the sum of balances in state
            require(EtherExtension.getTotal(_state) == bonded);
        }

        // ERC20 Token joining deposit
        if(_ext == 1) {}

        // ERC721 Object joining deposit
        if(_ext == 2) {}

        // CKBA Stats joining deposit
        if(_ext == 3) {}  

        // Set storage for state
        partyB = _joiningParty;
        // no longer allow joining functions to be called
        isOpen = true;
    }

    // Updates must be additive
    function updateAgreement(bytes _state, uint8 _ext, uint8[2] sigV, bytes32[2] sigR, bytes32[2] sigS) payable {
        address _partyA = _getSig(_state, sigV[0], sigR[0], sigS[0]);
        address _partyB = _getSig(_state, sigV[1], sigR[1], sigS[1]);

        // Require both signatures 
        require(_hasAllSigs(_partyA, _partyB));

        // Ether deposit update
        if(_ext == 0) {
            uint256 _balA = EtherExtension.getBalanceA(_state);
            uint256 _balB = EtherExtension.getBalanceB(_state);
            uint256 _total = EtherExtension.getTotal(_state);

            address _a = EtherExtension.getPartyA(_state);
            address _b = EtherExtension.getPartyB(_state);
            require(_a == partyA && _b == partyB);

            bonded += msg.value;
            require(_total == bonded);
            extensionUsed[0] = true;
        }

        // ERC20 Token adding deposit
        if(_ext == 1) {}

        // ERC721 Object adding deposit
        if(_ext == 2) {}

        // CKBA Stats adding deposit
        if(_ext == 3) {}  

        // Set storage for state
        //state = _state;
    }

    // TODO allow executing subchannel state. this will allow an on-chain sub-channel close
    // and removal of assets from the channel without closing and removing everything
    function executeStateSector() {
        // this might require an executable flag on the state like the isClose sentinel.
        // this flag would represent an agreement to execute the given state
        // this state should reflect the current state of the metachannel, which in cases
        // of fault will reflect the final outcome of subchannel settlement
    }

    // needs to have settlement process to close the final balance
    // or just check that the meta channel has closed on a settle process
    // this allows the spc to checkpoint state
    function closeAgreementWithTimeout(bytes _state) public {
        MetaChannel deployedMetaChannel = MetaChannel(registry.resolveAddress(metachannel));

        require(deployedMetaChannel.isClosed() == 1);

        require(keccak256(_state) == deployedMetaChannel.statehash());
        //state = _state;

        //_finalize();
        isOpen = false;
    }


    function closeAgreement(bytes _state, uint8[2] sigV, bytes32[2] sigR, bytes32[2] sigS) public {

        address _partyA = _getSig(_state, sigV[0], sigR[0], sigS[0]);
        address _partyB = _getSig(_state, sigV[1], sigR[1], sigS[1]);

        require(_isClose(_state));
        require(_hasAllSigs(_partyA, _partyB));

        //_finalize();
        isOpen = false;
    }

    function finalizeSector(bytes _sectorState) public {
        // This may only be called 
        require(isOpen == false);

        // check to see if sector is contained in sector root hash

        // get extension type for sector

    }


    // this should delegate call to an extension to read the state 
    // that was agreed upon either 
    //  1. Coop case: State has both parties sigs with an agreement to close
    //  2. Non-coop case: State has one sig
    // no force pushing of state here due to state transitions resulting in value transfer
    // it is conceivable that you could force an advantageous final state and ddos your counterparty
    // this currently works with ether only. It should take a list of extenstions that need to be called
    function _finalize() internal {
        if(extensionUsed[0] == true) {
            require(EtherExtension.getTotal(state) == bonded);
            partyA.transfer(EtherExtension.getBalanceA(state));
            partyB.transfer(EtherExtension.getBalanceB(state));
        }
        
        if(extensionUsed[1] == true) {}
    }

    function _hasAllSigs(address _a, address _b) internal view returns (bool) {
        require(_a == partyA && _b == partyB);

        return true;
    }

    function _isClose(bytes _data) internal pure returns(bool) {
        uint isClosed;

        assembly {
            isClosed := mload(add(_data, 32))
        }

        require(isClosed == 1);
        return true;
    }

    function _getSig(bytes _d, uint8 _v, bytes32 _r, bytes32 _s) internal pure returns(address) {
        bytes memory prefix = "\x19Ethereum Signed Message:\n32";
        bytes32 h = keccak256(_d);

        bytes32 prefixedHash = keccak256(prefix, h);

        address a = ecrecover(prefixedHash, _v, _r, _s);

        //address a = ECRecovery.recover(prefixedHash, _s);

        return(a);
    }
}
