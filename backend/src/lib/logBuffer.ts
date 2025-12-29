type LogEntry = { level: 'log' | 'warn' | 'error' | 'info', ts: string, msg: string }

class LogBuffer {
  private capacity: number
  private buf: LogEntry[] = []

  constructor(capacity = 1000) {
    this.capacity = capacity
  }

  push(level: LogEntry['level'], msg: string) {
    const entry: LogEntry = { level, ts: new Date().toISOString(), msg }
    this.buf.push(entry)
    if (this.buf.length > this.capacity) this.buf.shift()
  }

  tail(count = 200) {
    return this.buf.slice(-count)
  }

  clear() {
    this.buf = []
  }
}

export const logBuffer = new LogBuffer(1000)

export default logBuffer
