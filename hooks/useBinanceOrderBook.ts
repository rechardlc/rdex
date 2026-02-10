'use client';

import { useEffect, useRef } from 'react';
import { useOrderBookStore } from '@/stores/useOrderBookStore';
import { OrderBookUpdate } from '@/types/binance';

export function useBinanceOrderBook(symbol: string = 'btcusdt') {
  const wsRef = useRef<WebSocket | null>(null);
  const updateOrderBook = useOrderBookStore((state) => state.updateOrderBook);
  const reset = useOrderBookStore((state) => state.reset);

  useEffect(() => {
    // Reset order book on mount
    reset();

    // WebSocket URL for order book depth stream
    const wsUrl = `wss://stream.binance.com:9443/ws/${symbol}@depth@100ms`;

    // Create WebSocket connection
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log(`WebSocket connected: ${symbol} order book`);
    };

    ws.onmessage = (event) => {
      try {
        const data: OrderBookUpdate = JSON.parse(event.data);
        updateOrderBook(data);
      } catch (error) {
        console.error('Error parsing order book data:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected: order book');
    };

    // Cleanup on unmount
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [symbol, updateOrderBook, reset]);

  return null;
}
