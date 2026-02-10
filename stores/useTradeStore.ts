import { create } from 'zustand';
import { TradeData } from '@/types/binance';

interface Trade {
  id: number;
  price: string;
  quantity: string;
  time: number;
  isBuyerMaker: boolean;
}

interface TradeState {
  trades: Trade[];
  lastPrice: string;
  priceChange: number; // 1 for up, -1 for down, 0 for no change
  addTrade: (data: TradeData) => void;
  reset: () => void;
}

export const useTradeStore = create<TradeState>((set) => ({
  trades: [],
  lastPrice: '0',
  priceChange: 0,

  addTrade: (data: TradeData) => {
    set((state) => {
      const newTrade: Trade = {
        id: data.t,
        price: data.p,
        quantity: data.q,
        time: data.T,
        isBuyerMaker: data.m,
      };

      // Determine price change direction
      let priceChange = 0;
      if (state.lastPrice !== '0') {
        const lastPriceNum = parseFloat(state.lastPrice);
        const currentPriceNum = parseFloat(data.p);
        if (currentPriceNum > lastPriceNum) priceChange = 1;
        else if (currentPriceNum < lastPriceNum) priceChange = -1;
      }

      // Keep only last 50 trades
      const trades = [newTrade, ...state.trades].slice(0, 50);

      return {
        trades,
        lastPrice: data.p,
        priceChange,
      };
    });
  },

  reset: () => set({ trades: [], lastPrice: '0', priceChange: 0 }),
}));
