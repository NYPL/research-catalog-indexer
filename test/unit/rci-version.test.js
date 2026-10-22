const expect = require('chai').expect
const sinon = require('sinon')
const childProcess = require('child_process')
const { version } = require('../../package.json')

describe('rciVersion', () => {
  let execSyncStub
  let originalLambdaTaskRoot

  beforeEach(() => {
    delete require.cache[require.resolve('../../lib/utils/rci-version')]
    execSyncStub = sinon.stub(childProcess, 'execSync')
    originalLambdaTaskRoot = process.env.LAMBDA_TASK_ROOT
    delete process.env.LAMBDA_TASK_ROOT
  })

  afterEach(() => {
    execSyncStub.restore()
    if (originalLambdaTaskRoot === undefined) delete process.env.LAMBDA_TASK_ROOT
    else process.env.LAMBDA_TASK_ROOT = originalLambdaTaskRoot
  })

  it('returns the plain version when running in the deployed Lambda', () => {
    process.env.LAMBDA_TASK_ROOT = '/var/task'
    const { rciVersion } = require('../../lib/utils/rci-version')

    expect(rciVersion()).to.equal(version)
    // No git command needed bc since LAMBDA_TASK_ROOT short-circuits the check
    expect(execSyncStub.called).to.equal(false)
  })

  it('returns the version when HEAD tree matches the release tag', () => {
    execSyncStub.withArgs(`git rev-parse v${version}^{tree}`, sinon.match.any).returns('sametree\n')
    execSyncStub.withArgs('git rev-parse HEAD^{tree}', sinon.match.any).returns('sametree\n')
    const { rciVersion } = require('../../lib/utils/rci-version')

    expect(rciVersion()).to.equal(version)
  })

  it('appends "-local" when HEAD does not match the release tag', () => {
    execSyncStub.withArgs(`git rev-parse v${version}^{tree}`, sinon.match.any).returns('released-tree\n')
    execSyncStub.withArgs('git rev-parse HEAD^{tree}', sinon.match.any).returns('feature-branch-tree\n')
    const { rciVersion } = require('../../lib/utils/rci-version')

    expect(rciVersion()).to.equal(`${version}-local`)
  })

  it('appends "-local" when git commands fail (like no .git directory, offline)', () => {
    execSyncStub.throws(new Error('not a git repository'))
    const { rciVersion } = require('../../lib/utils/rci-version')

    expect(rciVersion()).to.equal(`${version}-local`)
  })

  it('memoizes the result so git situation is only checked once per process', () => {
    execSyncStub.withArgs(`git rev-parse v${version}^{tree}`, sinon.match.any).returns('sametree\n')
    execSyncStub.withArgs('git rev-parse HEAD^{tree}', sinon.match.any).returns('sametree\n')
    const { rciVersion } = require('../../lib/utils/rci-version')

    rciVersion()
    rciVersion()
    rciVersion()

    expect(execSyncStub.callCount).to.equal(2)
  })
})
