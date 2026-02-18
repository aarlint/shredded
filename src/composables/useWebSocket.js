const wsHandlers = new Set()
let ws = null
let wsRetryDelay = 1000

export function connectWS() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  ws = new WebSocket(`${proto}//${location.host}/ws`)
  ws.onopen = () => {
    wsRetryDelay = 1000
  }
  ws.onmessage = (e) => {
    try {
      const { event, data } = JSON.parse(e.data)
      for (const handler of wsHandlers) {
        handler(event, data)
      }
    } catch {}
  }
  ws.onclose = () => {
    setTimeout(() => {
      wsRetryDelay = Math.min(wsRetryDelay * 2, 30000)
      connectWS()
    }, wsRetryDelay)
  }
}

export function onWS(handler) {
  wsHandlers.add(handler)
}

export function offWS(handler) {
  wsHandlers.delete(handler)
}

export function useWebSocket() {
  return { connectWS, onWS, offWS }
}
