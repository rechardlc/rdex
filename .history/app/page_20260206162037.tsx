'use client';

import { OrderBook } from '@/components/OrderBook';
import { KlineChart } from '@/components/KlineChart';
import { AssetCalculator } from '@/components/AssetCalculator';
import { LiveTrades } from '@/components/LiveTrades';
import { useBinanceOrderBook } from '@/hooks/useBinanceOrderBook';
import { useBinanceTrades } from '@/hooks/useBinanceTrades';

export default function Home() {
  // Initialize WebSocket connections
  useBinanceOrderBook('btcusdt');
  useBinanceTrades('btcusdt');

  return (
    <div className="min-h-screen bg-black p-4">
      {/* Header */}
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">
          Crypto Exchange Demo
        </h1>
        <p className="text-gray-400 text-sm">
          Real-time BTC/USDT trading powered by Binance WebSocket API
        </p>
      </header>

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left column: Chart and Trades */}
        <div className="lg:col-span-2 space-y-4">
          {/* K-line Chart */}
          <KlineChart symbol="btcusdt" interval="1d" />

          {/* Recent Trades */}
          {/* <LiveTrades /> */}
        </div>

        {/* Right column: Order Book and Trading */}
        <div className="space-y-4">
          {/* Asset Calculator */}
          {/* <AssetCalculator /> */}

          {/* Order Book */}
          <div className="h-[600px]">
            {/* <OrderBook /> */}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-8 text-center text-gray-500 text-xs">
        <p>
          Demo project using React 18, Zustand, Lightweight Charts, and TanStack
          Virtual
        </p>
        <p className="mt-1">Data provided by Binance Public WebSocket API</p>
      </footer>
    </div>
  );
}
