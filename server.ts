import express from "express";
import { createServer as createViteServer } from "vite";
import yahooFinance from "yahoo-finance2";
import path from "path";
import fs from "fs";

// Helper to initialize yahooFinance for v3
let yf: any = yahooFinance;
if (typeof yf === 'function') {
  try {
      yf = new (yf as any)();
  } catch (e) {
      console.log("Failed to instantiate yahooFinance directly:", e);
  }
} else if (yf && typeof yf === 'object' && 'default' in yf && typeof (yf as any).default === 'function') {
    try {
        yf = new (yf as any).default();
    } catch (e) {
        console.log("Failed to instantiate yahooFinance.default:", e);
    }
}

// Simple in-memory cache
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

const app = express();
const PORT = 3000;

async function setupServer() {
  // API routes FIRST
  app.get("/api/stock/:symbol", async (req, res) => {
    const { symbol } = req.params;
    const { period1, period2 } = req.query;

    if (!symbol || !period1 || !period2) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const cacheKey = `${symbol}-${period1}-${period2}`;
    const cached = cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log(`Serving cached data for ${symbol}`);
      return res.json(cached.data);
    }

    try {
      const p1 = new Date(Number(period1) * 1000);
      const p2 = new Date(Number(period2) * 1000);

      const queryOptions = {
        period1: p1,
        period2: p2,
        interval: "1d" as const,
        events: "div|split",
      };

      const result = await yf.chart(symbol, queryOptions) as any;
      
      let stockName = result.meta?.shortName || result.meta?.longName || symbol;
      if (symbol.endsWith('.HK')) {
        try {
          const quoteResult = await yf.quote(symbol, { lang: 'zh-Hant-HK', region: 'HK' });
          if (quoteResult && (quoteResult.longName || quoteResult.shortName)) {
            stockName = quoteResult.longName || quoteResult.shortName;
          }
        } catch (e) {
          console.error("Error fetching quote for name:", e);
        }
      }

      if (!result || !result.quotes || result.quotes.length === 0) {
        return res.status(404).json({ error: "No data found for the given symbol and period" });
      }

      const timestamps = result.quotes.map((q: any) => Math.floor(q.date.getTime() / 1000));
      const closes = result.quotes.map((q: any) => q.close);
      const opens = result.quotes.map((q: any) => q.open);
      const highs = result.quotes.map((q: any) => q.high);
      const lows = result.quotes.map((q: any) => q.low);

      const formattedData = {
        chart: {
          result: [
            {
              meta: {
                ...result.meta,
                stockName: stockName
              },
              timestamp: timestamps,
              indicators: {
                quote: [
                  {
                    close: closes,
                    open: opens,
                    high: highs,
                    low: lows
                  }
                ]
              },
              events: {
                dividends: result.events?.dividends || {},
                splits: result.events?.splits || {}
              }
            }
          ]
        }
      };

      cache.set(cacheKey, { data: formattedData, timestamp: Date.now() });
      res.json(formattedData);
    } catch (error: any) {
      if (error.message && (error.message.includes("404") || error.message.includes("No data found"))) {
        return res.status(404).json({ error: "無法獲取該股票數據，請檢查代號是否正確或已下市。" });
      }
      res.status(500).json({ error: "Failed to fetch stock data", details: error.message });
    }
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
    }
  }
}

// Only start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}` || process.env.NODE_ENV !== "production") {
  setupServer().then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  });
}

setupServer();

export default app;
