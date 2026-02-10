'use client';

import { useEffect, useRef } from 'react';
import { useTradeStore } from '@/stores/useTradeStore';
import { TradeData } from '@/types/binance';

export function useBinanceTrades(symbol: string = 'btcusdt') {
  const wsRef = useRef<WebSocket | null>(null);
  const addTrade = useTradeStore((state) => state.addTrade);
  const reset = useTradeStore((state) => state.reset);

  useEffect(() => {
    // Reset trades on mount
    reset();

    // WebSocket URL for trade stream
    const wsUrl = `wss://stream.binance.com:9443/ws/${symbol}@trade`;

    // Create WebSocket connection
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log(`WebSocket connected: ${symbol} trades`);
    };

    ws.onmessage = (event) => {
      try {
        const data: TradeData = JSON.parse(event.data);
        addTrade(data);
      } catch (error) {
        console.error('Error parsing trade data:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected: trades');
    };

    // Cleanup on unmount
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [symbol, addTrade, reset]);

  return null;
}
