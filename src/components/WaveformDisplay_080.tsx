import React, { useEffect, useRef } from 'react';

interface WaveformDisplayProps {
  color: string;
  data: number[]; // the latest data points to add
  minY: number;
  maxY: number;
  height?: number;
  speed?: number; // points to shift per frame
  stepX?: number; // spacing between points (绘图步长)
  smoothingWindow?: number; // Moving average window size for smoothness
  isPlaying?: boolean; // Whether playback is active
}

export const WaveformDisplay_080: React.FC<WaveformDisplayProps> = ({ 
  color, 
  data, 
  minY, 
  maxY, 
  height = 150,
  speed = 2,
  stepX = 1,
  smoothingWindow = 1,
  isPlaying = true
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bufferRef = useRef<number[]>([]);
  const animationRef = useRef<number>(0);
  const visualPointsRef = useRef<number[]>([]);
  const isPlayingRef = useRef(isPlaying);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    if (data.length > 0) {
      bufferRef.current.push(...data);
    }
  }, [data]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const heightPx = rect.height;

    // Maximum points needed to fill the screen width based on stepX
    const maxPoints = Math.ceil(width / stepX) + 1;
    
    // Initialize or keep existing points
    if (visualPointsRef.current.length === 0) {
      visualPointsRef.current = new Array(maxPoints).fill(minY);
    }

    const applySmoothing = (points: number[]) => {
      if (smoothingWindow <= 1 || points.length === 0) return points;
      const smoothed = new Array(points.length);
      for (let i = 0; i < points.length; i++) {
        let sum = 0;
        let count = 0;
        for (let j = Math.max(0, i - smoothingWindow + 1); j <= i; j++) {
          sum += points[j];
          count++;
        }
        smoothed[i] = sum / count;
      }
      return smoothed;
    };

    const draw = () => {
      // Consume data from buffer based on speed
      let shouldAdvance = true;
      if (!isPlayingRef.current && bufferRef.current.length === 0) {
        shouldAdvance = false; // Freeze if paused and buffer is empty
      }

      if (shouldAdvance) {
        const consumeCount = Math.min(speed, bufferRef.current.length);
        if (consumeCount > 0) {
          const consumed = bufferRef.current.splice(0, consumeCount);
          visualPointsRef.current.push(...consumed);
          
          if (visualPointsRef.current.length > maxPoints) {
            visualPointsRef.current = visualPointsRef.current.slice(visualPointsRef.current.length - maxPoints);
          }
        } else {
          if (isPlayingRef.current) { // Only push straight lines if actually playing
            const lastVal = visualPointsRef.current[visualPointsRef.current.length - 1] ?? minY;
            visualPointsRef.current.push(lastVal);
            if (visualPointsRef.current.length > maxPoints) {
              visualPointsRef.current.shift();
            }
          }
        }
      }

      ctx.clearRect(0, 0, width, heightPx);
      
      // Draw Grid
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < width; i += 20) {
        ctx.moveTo(i, 0);
        ctx.lineTo(i, heightPx);
      }
      for (let i = 0; i < heightPx; i += 20) {
        ctx.moveTo(0, i);
        ctx.lineTo(width, i);
      }
      ctx.stroke();

      // Draw Waveform
      const pointsToDraw = applySmoothing(visualPointsRef.current);
      
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      
      // Add a subtle shadow so the line pops out against the white background
      ctx.shadowColor = color;
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 2;

      ctx.beginPath();

      const range = maxY - minY;
      
      for (let i = 0; i < pointsToDraw.length; i++) {
        const val = pointsToDraw[i];
        let normalized = (val - minY) / range;
        normalized = Math.max(0, Math.min(1, normalized));
        const y = heightPx - (normalized * heightPx);
        const x = i * stepX;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();
      animationRef.current = requestAnimationFrame(draw);
    };

    animationRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [color, minY, maxY, speed, stepX, smoothingWindow]); // Removed isPlaying from dependencies

  return (
    <div style={{ width: '100%', height: `${height}px`, background: 'white', borderRadius: '12px', overflow: 'hidden', border: `1px solid ${color}40`, boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
};
