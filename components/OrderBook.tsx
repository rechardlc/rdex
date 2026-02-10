'use client';

import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useOrderBookStore } from '@/stores/useOrderBookStore';
import Decimal from 'decimal.js';
import { cn } from '@/lib/utils';

function OrderBookRow({
  price,
  quantity,
  total,
  percentage,
  type,
}: {
  price: string;
  quantity: string;
  total: string;
  percentage: number;
  type: 'bid' | 'ask';
}) {
  return (
    <div className="relative h-6 flex items-center text-xs font-mono">
      {/* Background bar showing depth */}
      <div
        className={cn(
          'absolute inset-y-0 right-0 transition-all duration-200',
          type === 'bid' ? 'bg-green-500/10' : 'bg-red-500/10'
        )}
        style={{ width: `${percentage}%` }}
      />

      {/* Content */}
      <div className="relative z-10 w-full flex justify-between px-3 gap-2">
        <span
          className={cn(
            'flex-1 font-semibold',
            type === 'bid' ? 'text-green-500' : 'text-red-500'
          )}
        >
          {parseFloat(price).toFixed(2)}
        </span>
        <span className="flex-1 text-gray-300 text-right">
          {parseFloat(quantity).toFixed(5)}
        </span>
        <span className="flex-1 text-gray-400 text-right">
          {parseFloat(total).toFixed(2)}
        </span>
      </div>
    </div>
  );
}

export function OrderBook() {
  const bids = useOrderBookStore((state) => state.bids);
  const asks = useOrderBookStore((state) => state.asks);

  const asksRef = useRef<HTMLDivElement>(null);
  const bidsRef = useRef<HTMLDivElement>(null);

  // Calculate cumulative totals and percentages
  const processLevels = (levels: typeof bids) => {
    let cumulativeTotal = new Decimal(0);
    const processed = levels.map((level) => {
      const quantity = new Decimal(level.quantity);
      const price = new Decimal(level.price);
      const total = quantity.mul(price);
      cumulativeTotal = cumulativeTotal.plus(total);
      return {
        ...level,
        total: cumulativeTotal.toFixed(2),
      };
    });

    // Calculate percentages
    const maxTotal = cumulativeTotal.toNumber();
    return processed.map((item) => ({
      ...item,
      percentage: maxTotal > 0 ? (parseFloat(item.total) / maxTotal) * 100 : 0,
    }));
  };

  const processedAsks = processLevels([...asks].reverse()); // Reverse for display
  const processedBids = processLevels(bids);

  // Virtual scrollers
  const asksVirtualizer = useVirtualizer({
    count: processedAsks.length,
    getScrollElement: () => asksRef.current,
    estimateSize: () => 24, // 24px height per row
    overscan: 5,
  });

  const bidsVirtualizer = useVirtualizer({
    count: processedBids.length,
    getScrollElement: () => bidsRef.current,
    estimateSize: () => 24,
    overscan: 5,
  });

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 rounded-lg overflow-hidden border border-gray-800">
      {/* Header */}
      <div className="bg-gray-800 px-3 py-2 border-b border-gray-700">
        <h2 className="text-sm font-semibold text-white">Order Book</h2>
      </div>

      {/* Column headers */}
      <div className="flex justify-between px-3 py-2 text-xs font-medium text-gray-400 border-b border-gray-800">
        <span className="flex-1">Price (USDT)</span>
        <span className="flex-1 text-right">Amount (BTC)</span>
        <span className="flex-1 text-right">Total (USDT)</span>
      </div>

      {/* Content split into asks and bids */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Asks (Sell orders) */}
        <div
          ref={asksRef}
          className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900"
        >
          <div
            style={{
              height: `${asksVirtualizer.getTotalSize()}px`,
              position: 'relative',
            }}
          >
            {asksVirtualizer.getVirtualItems().map((virtualItem) => {
              const item = processedAsks[virtualItem.index];
              return (
                <div
                  key={virtualItem.key}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  <OrderBookRow
                    price={item.price}
                    quantity={item.quantity}
                    total={item.total}
                    percentage={item.percentage}
                    type="ask"
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Current price separator */}
        <div className="flex items-center justify-between px-3 py-2 bg-gray-800 border-y border-gray-700">
          <span className="text-lg font-bold text-white">
            {processedBids[0]?.price
              ? parseFloat(processedBids[0].price).toFixed(2)
              : '---'}
          </span>
          <span className="text-xs text-gray-400">Current Price</span>
        </div>

        {/* Bids (Buy orders) */}
        <div
          ref={bidsRef}
          className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900"
        >
          <div
            style={{
              height: `${bidsVirtualizer.getTotalSize()}px`,
              position: 'relative',
            }}
          >
            {bidsVirtualizer.getVirtualItems().map((virtualItem) => {
              const item = processedBids[virtualItem.index];
              return (
                <div
                  key={virtualItem.key}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  <OrderBookRow
                    price={item.price}
                    quantity={item.quantity}
                    total={item.total}
                    percentage={item.percentage}
                    type="bid"
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
