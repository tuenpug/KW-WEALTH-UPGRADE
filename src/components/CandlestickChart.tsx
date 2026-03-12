import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, MouseEventParams, CandlestickSeries, LineSeries } from 'lightweight-charts';

interface ChartData {
  date: string; // 'YYYY-MM-DD'
  open: number;
  high: number;
  low: number;
  close: number;
  ma50?: number;
  ma100?: number;
  ma250?: number;
}

interface CandlestickChartProps {
  data: ChartData[];
  realTimePrice?: number;
}

export default function CandlestickChart({ data, realTimePrice }: CandlestickChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  
  const [legendData, setLegendData] = useState<{
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
    ma50?: number;
    ma100?: number;
    ma250?: number;
  } | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9CA3AF',
      },
      grid: {
        vertLines: { color: '#374151', style: 3 },
        horzLines: { color: '#374151', style: 3 },
      },
      width: chartContainerRef.current.clientWidth,
      height: 256, // h-64 = 256px
      timeScale: {
        borderColor: '#4B5563',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: '#4B5563',
      },
      crosshair: {
        mode: 1, // Normal mode
        vertLine: {
          color: '#9CA3AF',
          width: 1,
          style: 1,
          labelBackgroundColor: '#374151',
        },
        horzLine: {
          color: '#9CA3AF',
          width: 1,
          style: 1,
          labelBackgroundColor: '#374151',
        },
      },
    });

    chartRef.current = chart;

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });
    seriesRef.current = candlestickSeries;

    const ma50Series = chart.addSeries(LineSeries, { color: '#34D399', lineWidth: 2, title: 'MA50' });
    const ma100Series = chart.addSeries(LineSeries, { color: '#60A5FA', lineWidth: 2, title: 'MA100' });
    const ma250Series = chart.addSeries(LineSeries, { color: '#F472B6', lineWidth: 2, title: 'MA250' });

    const formattedData = data.map(d => ({
      time: d.date,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));

    candlestickSeries.setData(formattedData);

    const ma50Data = data.filter(d => d.ma50 !== undefined).map(d => ({ time: d.date, value: d.ma50! }));
    const ma100Data = data.filter(d => d.ma100 !== undefined).map(d => ({ time: d.date, value: d.ma100! }));
    const ma250Data = data.filter(d => d.ma250 !== undefined).map(d => ({ time: d.date, value: d.ma250! }));

    ma50Series.setData(ma50Data);
    ma100Series.setData(ma100Data);
    ma250Series.setData(ma250Data);

    chart.timeScale().fitContent();

    // Set initial legend data to the last data point
    if (data.length > 0) {
      const last = data[data.length - 1];
      setLegendData({
        time: last.date,
        open: last.open,
        high: last.high,
        low: last.low,
        close: last.close,
        ma50: last.ma50,
        ma100: last.ma100,
        ma250: last.ma250,
      });
    }

    // Subscribe to crosshair move
    chart.subscribeCrosshairMove((param: MouseEventParams) => {
      if (
        param.point === undefined ||
        !param.time ||
        param.point.x < 0 ||
        param.point.x > chartContainerRef.current!.clientWidth ||
        param.point.y < 0 ||
        param.point.y > chartContainerRef.current!.clientHeight
      ) {
        // Reset to last data point if out of bounds
        if (data.length > 0) {
          const last = data[data.length - 1];
          setLegendData({
            time: last.date,
            open: last.open,
            high: last.high,
            low: last.low,
            close: last.close,
            ma50: last.ma50,
            ma100: last.ma100,
            ma250: last.ma250,
          });
        }
      } else {
        const candleData = param.seriesData.get(candlestickSeries) as any;
        const ma50Val = param.seriesData.get(ma50Series) as any;
        const ma100Val = param.seriesData.get(ma100Series) as any;
        const ma250Val = param.seriesData.get(ma250Series) as any;
        
        if (candleData) {
          setLegendData({
            time: param.time as string,
            open: candleData.open,
            high: candleData.high,
            low: candleData.low,
            close: candleData.close,
            ma50: ma50Val?.value,
            ma100: ma100Val?.value,
            ma250: ma250Val?.value,
          });
        }
      }
    });

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [data]);

  useEffect(() => {
    if (seriesRef.current && realTimePrice && data.length > 0) {
      const lastData = data[data.length - 1];
      seriesRef.current.update({
        time: lastData.date,
        open: lastData.open,
        high: Math.max(lastData.high, realTimePrice),
        low: Math.min(lastData.low, realTimePrice),
        close: realTimePrice,
      });

      // Add a yellow price line and dot for real-time price
      if (chartRef.current) {
        // Remove existing real-time series if any
        if ((seriesRef.current as any)._realTimeSeries) {
          chartRef.current.removeSeries((seriesRef.current as any)._realTimeSeries);
        }
        
        const realTimeSeries = chartRef.current.addSeries(LineSeries, {
          color: '#FBBF24',
          lineWidth: 2,
          lineStyle: 2, // Dashed
          pointMarkersVisible: true,
          pointMarkersRadius: 6,
          lastValueVisible: true,
          priceLineVisible: true,
          priceLineColor: '#FBBF24',
          crosshairMarkerVisible: false,
        });
        
        realTimeSeries.setData([{ time: lastData.date, value: realTimePrice }]);
        (seriesRef.current as any)._realTimeSeries = realTimeSeries;
      }
    }
  }, [realTimePrice, data]);

  return (
    <div className="relative w-full h-full">
      <div ref={chartContainerRef} className="w-full h-full" />
      {legendData && (
        <div className="absolute top-2 left-2 z-10 flex flex-wrap gap-3 text-xs pointer-events-none bg-gray-900/60 backdrop-blur-sm p-2 rounded-lg border border-gray-700/50">
          <div className="text-gray-300 font-medium">{legendData.time}</div>
          <div className="flex gap-2">
            <span className="text-gray-400">O</span>
            <span className={legendData.close >= legendData.open ? "text-emerald-400" : "text-rose-400"}>
              {legendData.open.toFixed(2)}
            </span>
          </div>
          <div className="flex gap-2">
            <span className="text-gray-400">H</span>
            <span className={legendData.close >= legendData.open ? "text-emerald-400" : "text-rose-400"}>
              {legendData.high.toFixed(2)}
            </span>
          </div>
          <div className="flex gap-2">
            <span className="text-gray-400">L</span>
            <span className={legendData.close >= legendData.open ? "text-emerald-400" : "text-rose-400"}>
              {legendData.low.toFixed(2)}
            </span>
          </div>
          <div className="flex gap-2">
            <span className="text-gray-400">C</span>
            <span className={legendData.close >= legendData.open ? "text-emerald-400" : "text-rose-400"}>
              {legendData.close.toFixed(2)}
            </span>
          </div>
          {legendData.ma50 !== undefined && (
            <div className="flex gap-1 ml-2">
              <span className="text-[#34D399]">MA50:</span>
              <span className="text-gray-200">{legendData.ma50.toFixed(2)}</span>
            </div>
          )}
          {legendData.ma100 !== undefined && (
            <div className="flex gap-1">
              <span className="text-[#60A5FA]">MA100:</span>
              <span className="text-gray-200">{legendData.ma100.toFixed(2)}</span>
            </div>
          )}
          {legendData.ma250 !== undefined && (
            <div className="flex gap-1">
              <span className="text-[#F472B6]">MA250:</span>
              <span className="text-gray-200">{legendData.ma250.toFixed(2)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
