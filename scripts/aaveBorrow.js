const { getNamedAccounts, ethers } = require("hardhat");
const { getWeth,Amount } = require("./getWeth")

async function main(){
    // aave protocol treats everything as an ERC20 Token but we have ETH as currency wich is not an ERC20 Token
    // for those reasons we need wrapped Eth (WETH) to be a Gate to enable transfering ETH 
    // in simple terms: we deposit ETH to Token wrapped Eth smart contract to get WETH.  
    await getWeth(); 
    const {deployer} = await getNamedAccounts();
    // so we want to sart interracting with aave 
    // like allways i need abi and an address 
    // aave provide as with a "Lending pool" smart contract that has a getaddress() to give as the address 
    //of the aave contract visit https://docs.aave.com/developers/v/2.0/
    // addr = "0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5" 
    const lendingPool = await getLendingPool(deployer)
    console.log("lending pool address :", await lendingPool.address)
    // i deleted "ILendingPoolAdressesProvider.sol" because i got it in node_moduoles
    //depositing:
    /* 1. we need to approve our contract  at addr "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" where we got WETH */
    const wethTokenAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
    await approveErc20(wethTokenAddress, lendingPool.address, Amount, deployer)
    // let's deposit 
    console.log('depositing ...')
    await lendingPool.deposit(wethTokenAddress, Amount, deployer, 0)
    console.log("deposited !!")

    // Borrow part : see aave Risk section  
    // how much i have collateral, how much borrowed, how much i can borrow => lendingPool => getUserAccountData()
    // we should consider the risk params 
    // keep in mind that what amount available to borrow < amount deposited otherwise we get liquidation
    // aave keeps being solved thanks to healthFactor: >1 => liquidation 

    let {availableBorrowsETH,totalDebtETH}= await getBorrowUserData(lendingPool,deployer)

    // now i know how much i can borrow in ETH so i need to convert it to DAI (price feed) => aggregator 
    const DaiEthprice = await getDaiPrice()
    const amountDaiToBorrow = availableBorrowsETH.toString() * 0.95 *(1/DaiEthprice.toNumber())

    console.log("i can boorrow",amountDaiToBorrow ," DAI")
    // converting it to wei 
    const amountDaiToBorrowWei = ethers.utils.parseEther(amountDaiToBorrow.toString())

    console.log("so much Wei i can borrow",amountDaiToBorrowWei.toString())
    // get the dai addr from Token DAI on etherscan mainnet

    const daiTokenAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F"
    await borrowDai(daiTokenAddress, lendingPool, amountDaiToBorrowWei,deployer)

    // see the userData after borrowing 
    console.log("---------------------------------------------")
    await getBorrowUserData(lendingPool,deployer)
    console.log("---------------------------------------------")
    await repay(amountDaiToBorrowWei, daiTokenAddress, lendingPool, deployer)
    await getBorrowUserData(lendingPool,deployer)
    // pls note that even after repaying all the borrowed amount back, it does still a tiny amout 
    // well that is because of iterrest of borrowing DAI  = the price of the dept
    // here when we can use uniswap 

    //Note: 
    // when i deposit WETH to AAve protocol let me gain interrest for depositing => aWETH Token 



}
async function repay(
    amount,
    daiAddress,
    lendingPool,
    account
){
    // we need to approve it again 
    await approveErc20(daiAddress, lendingPool.address, amount, account)
    const repayTx = await lendingPool.repay(daiAddress,amount,1,account)
    await repayTx.wait(1)
    console.log('repaid !!')
}
async function borrowDai(
    daiAddress,
    lendingPool,
    daiAmountToBorrow,
    account

){
    const borrowTx = await lendingPool.borrow(daiAddress, daiAmountToBorrow,1,0,account)
    await borrowTx.wait(1)
    console.log("borrowed DAI")

}

async function getDaiPrice(){
    
    const DaiEthPriceFeed = await ethers.getContractAt(
        "AggregatorV3Interface",
        "0x773616E4d11A78F511299002da57A0a94577F1f4")
    const price = (await DaiEthPriceFeed.latestRoundData())[1]
    console.log("the DAI / ETH price is :",price.toString())    
    return price;
}   


async function getBorrowUserData(lendingPool, account){

    const{totalCollateralETH, totalDebtETH, availableBorrowsETH} = await lendingPool.getUserAccountData(account)
    
    console.log("how much i have collateral (ETH) = ",totalCollateralETH.toString())
    console.log("how much borrowed          (ETH) = ",totalDebtETH.toString())
    console.log("how much i can borrow      (ETH) = ",availableBorrowsETH.toString())

    return {availableBorrowsETH,totalDebtETH};
}


async function approveErc20(erc20Address, spenderAddress, amountToSpend, account){

    const erc20Token = await ethers.getContractAt("IERC20",erc20Address, account);
    const tx = await erc20Token.approve(spenderAddress, amountToSpend)
    await tx.wait(1)
    console.log("approved ! !!") 

}


async function getLendingPool(account){

    const iLendingPoolAdressesProvider = await ethers.getContractAt(
        "ILendingPoolAddressesProvider",
        "0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5",
        account)
    const lendingPoolAddr = await iLendingPoolAdressesProvider.getLendingPool();

    const lendingPool = await ethers.getContractAt("ILendingPool",lendingPoolAddr,account)
        return lendingPool;
}



main()
    .then(()=> process.exit(0))
    .catch((e)=>{
        console.log(e)
        process.exit(1)
    })