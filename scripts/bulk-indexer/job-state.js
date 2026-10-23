const fs = require('fs')
const logger = require('../../lib/logger')

/**
 *  Generic job-state class for representing a multi-state task
 */
class JobState {
  constructor (path, params) {
    this.basePath = path

    this.data = { params }
  }

  filePath () {
    return `${this.basePath}-status.json`
  }

  loadState () {
    if (fs.existsSync(this.filePath())) {
      logger.info(`Loading state from ${this.filePath()}`)

      let restoredData
      try {
        restoredData = JSON.parse(fs.readFileSync(this.filePath(), 'utf8'))
      } catch (e) {}
      if (!restoredData?.params || !restoredData?.status) {
        throw new Error('Error restoring state')
      }

      // Identify parameter changes:
      const changedParams = Object.entries(this.data.params)
        .filter(([k]) => !['offset'].includes(k))
        .filter(([k, v]) => restoredData.params[k] !== v)
        .map(([property, newValue]) => ({ property, newValue, oldValue: restoredData.params[property] }))

      this.data = restoredData

      // If parameters changed from previous invocation, respect that, but warn user:
      if (changedParams.length) {
        logger.warn(`Warning: ${changedParams.length} parameter(s) changed:`)
        changedParams.forEach(({ property, newValue, oldValue }) => {
          logger.warn(`  ${property}: ${oldValue} => ${newValue}`)
          this.data.params[property] = newValue
        })
      }
    } else {
      logger.info(`Initializing job state in ${this.filePath()}`)
      this.data = {
        ...this.data,
        status: 'preparing',
        started: new Date().toISOString()
      }
    }
  }

  updateStatus (status, message = null) {
    if (message) {
      this.addMessage(message)
    }
    console.log('updateStatus', status)

    this.save({ status })
  }

  status () {
    return this.data.status
  }

  addMessage (message) {
    if (!this.data.messages) this.data.messages = []
    this.data.messages.push({ message, time: new Date().toISOString() })
    this.save()
  }

  save (props = {}) {
    // Status changes can alter filePath, so check for that:
    const previousPath = this.filePath()

    this.data = {
      ...this.data,
      ...props,
      updated: new Date().toISOString()
    }
    fs.writeFileSync(this.filePath(), JSON.stringify(this.data, null, 2))

    if (this.filePath() !== previousPath) {
      fs.unlinkSync(previousPath)
    }
  }

  static fromParams (params, Klass = JobState) {
    let path
    if (params.csv) {
      path = params.csv
    } else {
      // Build filepath based on params:
      path = [
        `${params.type}s`,
        (params.nyplSource ? params.nyplSource : null),
        (params.hasMarc ? `with-marc-${params.hasMarc}` : null),
        (params.hasSubfield ? params.hasSubfield : null)
      ]
        .filter(Boolean)
        .join('-')
    }
    // Instantiate JobState subclass:
    const state = new Klass(path, params)
    state.loadState()
    const props = {}
    if (params.csv) {
      props.csv = params.csv
    }
    state.save(props)
    return state
  }
}

module.exports = { JobState }
