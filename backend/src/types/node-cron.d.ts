declare module 'node-cron' {
  interface ScheduledTask {
    start(): void
    stop(): void
    destroy(): void
  }

  function schedule(expression: string, func: () => void): ScheduledTask

  const _default: { schedule: typeof schedule }
  export { schedule, ScheduledTask }
  export default _default
}
