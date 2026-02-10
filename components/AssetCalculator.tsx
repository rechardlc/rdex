'use client';

import { useEffect } from 'react';
import { useCalculatorStore } from '@/stores/useCalculatorStore';
import { useTradeStore } from '@/stores/useTradeStore';
import { cn } from '@/lib/utils';
import Decimal from 'decimal.js';

export function AssetCalculator() {
  const {
    side,
    orderType,
    price,
    quantity,
    baseBalance,
    quoteBalance,
    setSide,
    setOrderType,
    setPrice,
    setQuantity,
    getTotal,
    canExecute,
    executeTrade,
  } = useCalculatorStore();

  const lastPrice = useTradeStore((state) => state.lastPrice);

  // Auto-fill price with last trade price for market orders
  useEffect(() => {
    if (orderType === 'market' && lastPrice !== '0') {
      setPrice(lastPrice);
    }
  }, [orderType, lastPrice, setPrice]);

  const handleQuantityChange = (value: string) => {
    // Allow only numbers and decimal point
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setQuantity(value);
    }
  };

  const handlePriceChange = (value: string) => {
    // Allow only numbers and decimal point
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setPrice(value);
    }
  };

  const handlePercentageClick = (percentage: number) => {
    try {
      if (side === 'buy') {
        // Calculate quantity based on available USDT
        if (price && parseFloat(price) > 0) {
          const availableQuote = new Decimal(quoteBalance).mul(percentage);
          const calculatedQuantity = availableQuote.div(price);
          setQuantity(calculatedQuantity.toFixed(8));
        }
      } else {
        // Calculate quantity based on available BTC
        const availableBase = new Decimal(baseBalance).mul(percentage);
        setQuantity(availableBase.toFixed(8));
      }
    } catch (error) {
      console.error('Error calculating percentage:', error);
    }
  };

  const total = getTotal();
  const canPlaceOrder = canExecute();

  return (
    <div className="w-full bg-gray-900 rounded-lg overflow-hidden border border-gray-800">
      {/* Header */}
      <div className="bg-gray-800 px-4 py-3 border-b border-gray-700">
        <h2 className="text-sm font-semibold text-white">Trade</h2>
      </div>

      <div className="p-4 space-y-4">
        {/* Side selector */}
        <div className="flex gap-2">
          <button
            onClick={() => setSide('buy')}
            className={cn(
              'flex-1 py-2 rounded-lg font-semibold text-sm transition-all',
              side === 'buy'
                ? 'bg-green-500 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            )}
          >
            Buy
          </button>
          <button
            onClick={() => setSide('sell')}
            className={cn(
              'flex-1 py-2 rounded-lg font-semibold text-sm transition-all',
              side === 'sell'
                ? 'bg-red-500 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            )}
          >
            Sell
          </button>
        </div>

        {/* Order type selector */}
        <div className="flex gap-2">
          <button
            onClick={() => setOrderType('limit')}
            className={cn(
              'flex-1 py-1.5 rounded text-xs font-medium transition-all',
              orderType === 'limit'
                ? 'bg-gray-700 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-750'
            )}
          >
            Limit
          </button>
          <button
            onClick={() => setOrderType('market')}
            className={cn(
              'flex-1 py-1.5 rounded text-xs font-medium transition-all',
              orderType === 'market'
                ? 'bg-gray-700 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-750'
            )}
          >
            Market
          </button>
        </div>

        {/* Price input */}
        <div className="space-y-1.5">
          <label className="text-xs text-gray-400">Price (USDT)</label>
          <input
            type="text"
            value={price}
            onChange={(e) => handlePriceChange(e.target.value)}
            disabled={orderType === 'market'}
            placeholder="0.00"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        {/* Quantity input */}
        <div className="space-y-1.5">
          <label className="text-xs text-gray-400">Quantity (BTC)</label>
          <input
            type="text"
            value={quantity}
            onChange={(e) => handleQuantityChange(e.target.value)}
            placeholder="0.00000000"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Percentage buttons */}
        <div className="flex gap-2">
          {[0.25, 0.5, 0.75, 1.0].map((percentage) => (
            <button
              key={percentage}
              onClick={() => handlePercentageClick(percentage)}
              className="flex-1 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-300 transition-all"
            >
              {percentage * 100}%
            </button>
          ))}
        </div>

        {/* Total */}
        <div className="space-y-1.5">
          <label className="text-xs text-gray-400">Total (USDT)</label>
          <div className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
            {total || '0.00'}
          </div>
        </div>

        {/* Execute button */}
        <button
          onClick={executeTrade}
          disabled={!canPlaceOrder}
          className={cn(
            'w-full py-3 rounded-lg font-semibold text-sm transition-all',
            canPlaceOrder
              ? side === 'buy'
                ? 'bg-green-500 hover:bg-green-600 text-white'
                : 'bg-red-500 hover:bg-red-600 text-white'
              : 'bg-gray-800 text-gray-500 cursor-not-allowed'
          )}
        >
          {side === 'buy' ? 'Buy BTC' : 'Sell BTC'}
        </button>

        {/* Balances */}
        <div className="pt-4 border-t border-gray-800 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Available BTC:</span>
            <span className="text-white font-mono">
              {parseFloat(baseBalance).toFixed(8)}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Available USDT:</span>
            <span className="text-white font-mono">
              {parseFloat(quoteBalance).toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
