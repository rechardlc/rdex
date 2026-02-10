'use client';

import { useTradeStore } from '@/stores/useTradeStore';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

export function LiveTrades() {
  const trades = useTradeStore((state) => state.trades);
  const lastPrice = useTradeStore((state) => state.lastPrice);
  const priceChange = useTradeStore((state) => state.priceChange);

  return (
    <div className="w-full bg-gray-900 rounded-lg overflow-hidden border border-gray-800">
      {/* Header */}
      <div className="bg-gray-800 px-4 py-2 border-b border-gray-700 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Recent Trades</h2>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-lg font-bold font-mono',
              priceChange === 1 && 'text-green-500',
              priceChange === -1 && 'text-red-500',
              priceChange === 0 && 'text-white'
            )}
          >
            {lastPrice !== '0' ? parseFloat(lastPrice).toFixed(2) : '---'}
          </span>
          {priceChange === 1 && <TrendingUp className="w-4 h-4 text-green-500" />}
          {priceChange === -1 && <TrendingDown className="w-4 h-4 text-red-500" />}
        </div>
      </div>

      {/* Column headers */}
      <div className="flex justify-between px-4 py-2 text-xs font-medium text-gray-400 border-b border-gray-800">
        <span className="flex-1">Price (USDT)</span>
        <span className="flex-1 text-right">Amount (BTC)</span>
        <span className="flex-1 text-right">Time</span>
      </div>

      {/* Trades list */}
      <div className="max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900">
        {trades.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-gray-500 text-sm">
            Waiting for trades...
          </div>
        ) : (
          trades.map((trade) => {
            const time = new Date(trade.time);
            const timeStr = time.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });

            return (
              <div
                key={trade.id}
                className="flex justify-between px-4 py-1.5 text-xs font-mono hover:bg-gray-800/50 transition-colors"
              >
                <span
                  className={cn(
                    'flex-1 font-semibold',
                    trade.isBuyerMaker ? 'text-red-500' : 'text-green-500'
                  )}
                >
                  {parseFloat(trade.price).toFixed(2)}
                </span>
                <span className="flex-1 text-gray-300 text-right">
                  {parseFloat(trade.quantity).toFixed(5)}
                </span>
                <span className="flex-1 text-gray-400 text-right">{timeStr}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
