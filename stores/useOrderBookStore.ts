import { create } from 'zustand';
import Decimal from 'decimal.js';
import { OrderBookLevel, OrderBookUpdate } from '@/types/binance';

interface OrderBookState {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  updateOrderBook: (data: OrderBookUpdate) => void;
  reset: () => void;
}

// Helper function to update order book levels
function updateLevels(
  existingLevels: OrderBookLevel[],
  updates: [string, string][],
  isBid: boolean
): OrderBookLevel[] {
  const levelMap = new Map<string, string>();

  // Add existing levels to map
  existingLevels.forEach(level => {
    levelMap.set(level.price, level.quantity);
  });

  // Apply updates
  updates.forEach(([price, quantity]) => {
    if (new Decimal(quantity).isZero()) {
      levelMap.delete(price);
    } else {
      levelMap.set(price, quantity);
    }
  });

  // Convert map back to array and sort
  const levels = Array.from(levelMap.entries())
    .map(([price, quantity]) => ({ price, quantity }))
    .sort((a, b) => {
      const priceA = new Decimal(a.price);
      const priceB = new Decimal(b.price);
      return isBid
        ? priceB.minus(priceA).toNumber() // Descending for bids
        : priceA.minus(priceB).toNumber(); // Ascending for asks
    });

  // Keep only top 100 levels for performance
  return levels.slice(0, 100);
}

export const useOrderBookStore = create<OrderBookState>((set) => ({
  bids: [],
  asks: [],

  updateOrderBook: (data: OrderBookUpdate) => {
    set((state) => ({
      bids: updateLevels(state.bids, data.b, true),
      asks: updateLevels(state.asks, data.a, false),
    }));
  },

  reset: () => set({ bids: [], asks: [] }),
}));
