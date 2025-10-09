const logger = require('./lib/logger')

const batchTimers = {}

class BatchTimer {
  constructor (name) {
    this.name = name
    this.timers = []
  }

  static addTimer (timer, batchName) {
    const batch = batchTimers[batchName]
    batch.timers.push(timer)
  }

  totalTime () {
    let time = 0
    this.timers.forEach(function (t) { time += t.howManyRaw() })
    return time
  }

  howMuchTotalTime (unit) {
    logger.info(`${this.name} ran ${this.timers.length} batches`)
    Timer.prototype.howMuch(unit, this.totalTime())
  }
}

BatchTimer.createBatch = (batchName) => {
  batchTimers[batchName] = new BatchTimer(batchName)
}

class Timer {
  constructor (name) {
    this.name = name
    this.start = null
    this.end = null
  }

  startTimer () {
    logger.debug(`Starting timer for ${this.name}`)
    this.start = new Date()
  }

  endTimer () {
    logger.debug(`Ending timer for ${this.name}`)
    this.end = new Date()
  }

  howManyRaw () {
    return (this.end - this.start)
  }

  howMany (unit, time, name) {
    if (!time) time = this.howManyRaw()
    if (!name) name = this.name
    const unitDivisor = {
      ms: 1,
      seconds: 1000,
      minutes: 60 * 1000,
      hours: 60 * 60 * 1000
    }
    if (!unitDivisor[unit]) throw new Error('Invalid unit passed to Timer')
    const massagedTime = time / unitDivisor[unit]
    logger.info(`${name} took ${massagedTime} ${unit} to run`)
  }
}

module.exports = { Timer, BatchTimer }
