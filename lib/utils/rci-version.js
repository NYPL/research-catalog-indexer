const { execSync } = require('child_process')
const { version } = require('../../package.json')

/**
 *  true only when HEAD's tree content matches the commit tagged `v{version}`.
 *  promoting main -> qa -> production creates a new merge commit even when the code is unchanged.
 */
const isTaggedRelease = () => {
  try {
    const tag = `v${version}`
    const tagTree = execSync(`git rev-parse ${tag}^{tree}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
    const headTree = execSync('git rev-parse HEAD^{tree}', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
    return tagTree === headTree
  } catch (e) {
    return false
  }
}

/**
 *  true when the running code can be trusted to match `version`: either
 *  it's the actual deployed Lambda, an AWS Batch job, or
 *  it's a local/EC2 run from the exact commit tagged as that release.
 *  TODO: revisit these expectations in the managed bulk indexing future 12/2026
 */
const isPureDeployedCheckout = () => Boolean(process.env.LAMBDA_TASK_ROOT) || Boolean(process.env.AWS_BATCH_CE_NAME) || isTaggedRelease()

/**
 *  Get the current RCI version from package.json (ex. "1.0.0"), appends
 *  "-local" if it's not the versioned code. memoized since the result can't
 *  change during the life of the process
 */
let cachedRciVersion
const rciVersion = () => {
  if (cachedRciVersion === undefined) {
    cachedRciVersion = isPureDeployedCheckout() ? version : `${version}-local`
  }
  return cachedRciVersion
}

module.exports = { rciVersion }
