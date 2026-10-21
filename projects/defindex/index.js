const { getConfig } = require('../helper/cache')
const { get } = require('../helper/http')
const { callSoroban } = require('../helper/chain/stellar')

const DEFINDEX_API = 'https://api.defindex.io'
const DEFINDEX_VAULTS_INFO_URL = `${DEFINDEX_API}/vault/discover?network=mainnet`

// Soroban RPC cannot simulate contract calls at a past ledger, so historical
// runs read per-asset balances reconstructed by the DeFindex indexer from
// on-chain vault and strategy events.
async function historicalTvl(api) {
    const { tvl } = await get(`${DEFINDEX_API}/tvl?timestamp=${api.timestamp}&network=mainnet`)
    for (const [asset, amount] of Object.entries(tvl))
        api.add(asset, amount)
}

async function tvl(api) {
    if (api.timestamp && Date.now() / 1e3 - api.timestamp > 3600)
        return historicalTvl(api)

    const res = await getConfig('defindex', DEFINDEX_VAULTS_INFO_URL)
    const vaultAddresses = res?.vaults?.map(v => v.address) || []

    for (const vault of vaultAddresses) {
        const funds = await callSoroban(vault, 'fetch_total_managed_funds')
        for (const fund of funds) {
            if (fund.asset && fund.total_amount != null) {
                api.add(fund.asset, fund.total_amount.toString())
            }
        }
    }
}

module.exports = {
    timetravel: true,
    start: '2025-05-29',
    methodology: 'TVL is the sum of all assets managed by DeFindex vaults on Stellar. Current TVL is fetched on-chain via Soroban RPC simulation of each vault contract; historical TVL comes from the DeFindex indexer, which reconstructs each vault\'s strategy positions from on-chain events.',
    stellar: { tvl },
}
