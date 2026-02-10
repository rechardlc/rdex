'use client';

import { useEffect, useRef } from 'react';
import { KlineEvent } from '@/types/binance';
import { IChartApi } from 'lightweight-charts';

export function useBinanceKline(
  symbol: string = 'btcusdt',
  interval: string = '1m',
  chartApi: IChartApi | null
) {
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!chartApi) return;

    // WebSocket URL for kline stream
    const wsUrl = `wss://stream.binance.com:9443/ws/${symbol}@kline_${interval}`;

    // Create WebSocket connection
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log(`WebSocket connected: ${symbol} kline ${interval}`);
    };

    ws.onmessage = (event) => {
      try {
        const data: KlineEvent = JSON.parse(event.data);
        const kline = data.k;

        // Update chart with new kline data
        // Note: We'll handle this in the component
        if (kline) {
          // Dispatch custom event with kline data
          window.dispatchEvent(
            new CustomEvent('kline-update', {
              detail: {
                time: Math.floor(kline.t / 1000),
                open: parseFloat(kline.o),
                high: parseFloat(kline.h),
                low: parseFloat(kline.l),
                close: parseFloat(kline.c),
              },
            })
          );
        }
      } catch (error) {
        console.error('Error parsing kline data:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected: kline');
    };

    // Cleanup on unmount
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [symbol, interval, chartApi]);

  return null;
}
