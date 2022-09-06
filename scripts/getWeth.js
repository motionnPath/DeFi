const { getNamedAccounts, ethers } = require("hardhat")

const Amount = ethers.utils.parseEther("0.02");

async function getWeth(){

    const {deployer} = await getNamedAccounts()

    // to interract with contract we need
    // abi (we have the interface IWeth.sol) and the address wich is on etherscan mainnet
    // 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2

    const iweth = await ethers.getContractAt("IWeth","0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",deployer)
    
    // we are also hardcoding the Contractaddress instead of using a mock (to test accourdinly the used network)
    // but in this exemple i am going to lean about Mainnet forking (a test tool) 
    // forking Mainnet = the hardhat node will pretend to be mainnet and run this as if it was a locall blockchain 
    // all i need is to change mw hardhat.config and get the mainnet rpc url from alchemy

    const tx = await iweth.deposit({value:Amount});
    await tx.wait(1);
    const wethBalance = await iweth.balanceOf(deployer);
    console.log(`Got ${wethBalance.toString()} WETH`)
}

module.exports = {
    getWeth,
    Amount
}