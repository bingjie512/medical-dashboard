import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, Activity } from 'lucide-react';
import './App.css';
import { SpO2Parser_080 } from './core/spo2_parser_080';
import type { SpO2Data_080 } from './core/spo2_parser_080';
import { ECGParser_080 } from './core/ecg_parser_080';
import type { ECGData_080 } from './core/ecg_parser_080';
import { PlaybackModule_080 } from './core/playback_module_080';
import { WaveformDisplay_080 } from './components/WaveformDisplay_080';

type Mode = 'SPO2' | 'ECG';

function App() {
  const [mode, setMode] = useState<Mode>('SPO2');
  
  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [timeStr, setTimeStr] = useState('00:00 / 00:00');
  const [speed, setSpeed] = useState(1);
  const [fileLoaded, setFileLoaded] = useState(false);

  // SpO2 State
  const [spo2Data, setSpo2Data] = useState<SpO2Data_080>({ spo2: null, pr: null, ss: 0, bar: 0, waveform: 0 });
  const [spo2WaveformChunk, setSpo2WaveformChunk] = useState<number[]>([]);
  const [spo2StepX, setSpo2StepX] = useState<number>(2);
  const [spo2Smoothing, setSpo2Smoothing] = useState<number>(3);
  
  // ECG State
  const [ecgData, setEcgData] = useState<Partial<ECGData_080>>({ hr: null, leadOff: false, packetRate: 100 });
  const [ecgWaveformChunk, setEcgWaveformChunk] = useState<number[]>([]);
  const [ecgStepX, setEcgStepX] = useState<number>(1.5);
  const [ecgMinY, setEcgMinY] = useState<number>(1800);
  const [ecgMaxY, setEcgMaxY] = useState<number>(2300);

  // Refs for core modules
  const playbackRef = useRef<PlaybackModule_080 | null>(null);
  const spo2ParserRef = useRef<SpO2Parser_080 | null>(null);
  const ecgParserRef = useRef<ECGParser_080 | null>(null);

  const spo2BufferRef = useRef<number[]>([]);
  const ecgBufferRef = useRef<number[]>([]);

  useEffect(() => {
    spo2ParserRef.current = new SpO2Parser_080((data) => {
      setSpo2Data(data);
      spo2BufferRef.current.push(data.waveform);
    });

    ecgParserRef.current = new ECGParser_080((data) => {
      if (data.hr !== undefined || data.leadOff !== undefined || data.packetRate !== undefined) {
        setEcgData(prev => ({ ...prev, ...data }));
      }
      if (data.waveform !== undefined && data.waveform !== null) {
        ecgBufferRef.current.push(data.waveform);
      }
    });

    const flushInterval = setInterval(() => {
      if (spo2BufferRef.current.length > 0) {
        setSpo2WaveformChunk([...spo2BufferRef.current]);
        spo2BufferRef.current = [];
      }
      if (ecgBufferRef.current.length > 0) {
        setEcgWaveformChunk([...ecgBufferRef.current]);
        ecgBufferRef.current = [];
      }
    }, 50);

    return () => clearInterval(flushInterval);
  }, []);

  const initPlayback = (buffer: ArrayBuffer, type: Mode) => {
    if (playbackRef.current) {
      playbackRef.current.stop();
    }
    
    const bytesPerSec = type === 'SPO2' ? 300 : 5000;

    playbackRef.current = new PlaybackModule_080(
      bytesPerSec,
      (chunk) => {
        if (type === 'SPO2') {
          spo2ParserRef.current?.parseChunk(chunk);
        } else {
          ecgParserRef.current?.parseChunk(chunk);
        }
      },
      (p, t) => {
        setProgress(p);
        setTimeStr(t);
      },
      () => {
        setIsPlaying(false);
      }
    );

    playbackRef.current.loadData(buffer);
    setFileLoaded(true);
    setIsPlaying(false);
    setProgress(0);
    
    if (type === 'SPO2') spo2ParserRef.current?.reset();
    if (type === 'ECG') ecgParserRef.current?.reset();
  };

  const loadPresetData = async (type: Mode) => {
    try {
      const filename = type === 'SPO2' ? 'SPO2_20220602095410.bin' : 'ECG_20250421093851.bin';
      const response = await fetch(`/${filename}`);
      if (!response.ok) throw new Error('File not found');
      const arrayBuffer = await response.arrayBuffer();
      setMode(type);
      initPlayback(arrayBuffer, type);
    } catch (error) {
      alert(`无法加载预置文件: ${error}`);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: Mode) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const buffer = event.target?.result as ArrayBuffer;
      if (buffer) {
        setMode(type);
        initPlayback(buffer, type);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const togglePlay = () => {
    if (!playbackRef.current) return;
    if (isPlaying) {
      playbackRef.current.pause();
    } else {
      playbackRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const stopPlayback = () => {
    if (!playbackRef.current) return;
    playbackRef.current.stop();
    setIsPlaying(false);
    setSpo2Data({ spo2: null, pr: null, ss: 0, bar: 0, waveform: 0 });
    setEcgData({ hr: null, leadOff: false, packetRate: 100 });
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!playbackRef.current) return;
    const val = parseFloat(e.target.value);
    if (mode === 'SPO2') spo2ParserRef.current?.reset();
    if (mode === 'ECG') ecgParserRef.current?.reset();
    playbackRef.current.seek(val);
  };

  const handleSpeedChange = (newSpeed: number) => {
    if (!playbackRef.current) return;
    setSpeed(newSpeed);
    playbackRef.current.setSpeed(newSpeed);
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-title">
          <Activity color="#FF8C00" size={28} />
          <h1>生理参数测试工具 <span className="badge">最阳光之人</span></h1>
        </div>
        <div className="personal-info">
          <span>研发工程师：<strong>三杯橘</strong></span>
          <span className="divider">|</span>
          <span>学号：<strong>***080</strong></span>
        </div>
      </header>

      <main className="main-content">
        <div className="glass-panel control-panel">
          <div className="mode-selector">
            <button className={`mode-btn ${mode === 'SPO2' ? 'active' : ''}`} onClick={() => loadPresetData('SPO2')}>
              加载预置血氧数据
            </button>
            <button className={`mode-btn ${mode === 'ECG' ? 'active' : ''}`} onClick={() => loadPresetData('ECG')}>
              加载预置心电数据
            </button>
            <div className="file-upload">
              <label htmlFor="custom-file" className="upload-btn">自定义文件</label>
              <input id="custom-file" type="file" onChange={(e) => handleFileUpload(e, mode)} style={{display: 'none'}} />
            </div>
          </div>

          <div className="playback-controls">
            <button className="icon-btn" onClick={togglePlay} disabled={!fileLoaded}>
              {isPlaying ? <Pause size={20} /> : <Play size={20} />}
            </button>
            <button className="icon-btn" onClick={stopPlayback} disabled={!fileLoaded}>
              <Square size={20} />
            </button>
            
            <div className="speed-control">
              {['0.5', '1', '2', '4'].map(s => (
                <button 
                  key={s} 
                  className={`speed-btn ${speed === parseFloat(s) ? 'active' : ''}`}
                  onClick={() => handleSpeedChange(parseFloat(s))}
                  disabled={!fileLoaded}
                >
                  x{s}
                </button>
              ))}
            </div>

            <div className="progress-container">
              <span className="time-display">{timeStr}</span>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.001" 
                value={progress} 
                onChange={handleSeek}
                className="progress-bar"
                disabled={!fileLoaded}
              />
            </div>
          </div>
        </div>

        {/* Display Area */}
        <div className="display-area">
          {mode === 'SPO2' ? (
            <div className="glass-panel module-panel">
              <div className="panel-header">
                <h2 className="panel-title" style={{color: '#EA580C', margin: 0}}>血氧参数 (SpO2)</h2>
                <div className="settings-group">
                  <div className="setting-item">
                    <label>绘图步长</label>
                    <input type="range" min="1" max="10" step="0.5" value={spo2StepX} onChange={e => setSpo2StepX(parseFloat(e.target.value))} />
                    <span>{spo2StepX}</span>
                  </div>
                  <div className="setting-item">
                    <label>波形平滑度</label>
                    <input type="range" min="1" max="15" step="1" value={spo2Smoothing} onChange={e => setSpo2Smoothing(parseInt(e.target.value))} />
                    <span>{spo2Smoothing}</span>
                  </div>
                </div>
              </div>
              <div className="params-grid">
                <div className="param-card">
                  <span className="param-label">SPO2 (%)</span>
                  <span className="param-value">{spo2Data.spo2 ?? '---'}</span>
                </div>
                <div className="param-card">
                  <span className="param-label">PR (bpm)</span>
                  <span className="param-value">{spo2Data.pr ?? '---'}</span>
                </div>
                <div className="param-card">
                  <span className="param-label">SS (信号强度)</span>
                  <span className="param-value">{spo2Data.ss}</span>
                </div>
                <div className="param-card">
                  <span className="param-label">BAR (棒图)</span>
                  <span className="param-value">{spo2Data.bar}</span>
                </div>
              </div>
              <div className="waveform-container">
                <h3 className="waveform-title">脉搏容积波形</h3>
                <WaveformDisplay_080 
                  color="#EA580C" 
                  data={spo2WaveformChunk} 
                  minY={0} 
                  maxY={127} 
                  height={180}
                  speed={2}
                  stepX={spo2StepX}
                  smoothingWindow={spo2Smoothing}
                  isPlaying={isPlaying}
                />
              </div>
            </div>
          ) : (
            <div className="glass-panel module-panel">
              <div className="panel-header">
                <h2 className="panel-title" style={{color: '#0EA5E9', margin: 0}}>心电参数 (ECG)</h2>
                <div className="settings-group">
                  <div className="setting-item">
                    <label>绘图步长</label>
                    <input type="range" min="0.5" max="5" step="0.1" value={ecgStepX} onChange={e => setEcgStepX(parseFloat(e.target.value))} />
                    <span>{ecgStepX.toFixed(1)}</span>
                  </div>
                  <div className="setting-item">
                    <label>Y轴显示区间</label>
                    <select 
                      value={`${ecgMinY},${ecgMaxY}`} 
                      onChange={(e) => {
                        const [min, max] = e.target.value.split(',').map(Number);
                        setEcgMinY(min);
                        setEcgMaxY(max);
                      }}
                      className="range-select"
                    >
                      <option value="1800,2300">1800~2300 (推荐)</option>
                      <option value="1700,2400">1700~2400</option>
                      <option value="1500,2600">1500~2600</option>
                      <option value="0,4095">全量 0~4095</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="params-grid">
                <div className="param-card">
                  <span className="param-label">心率 (bpm)</span>
                  <span className="param-value" style={{color: ecgData.leadOff ? '#E53E3E' : '#0EA5E9'}}>
                    {ecgData.hr ?? '---'}
                  </span>
                </div>
                <div className="param-card">
                  <span className="param-label">导联状态</span>
                  <span className="param-value" style={{color: ecgData.leadOff ? '#E53E3E' : '#38A169', fontSize: '1.5rem'}}>
                    {ecgData.leadOff ? '脱落报警' : '正常'}
                  </span>
                </div>
                <div className="param-card">
                  <span className="param-label">有效包率 (Checksum通过率)</span>
                  <span className="param-value" style={{color: 'var(--text-primary)', fontSize: '1.5rem'}}>
                    {(ecgData.packetRate ?? 100).toFixed(2)}%
                  </span>
                </div>
              </div>
              <div className="waveform-container">
                <h3 className="waveform-title">心电波形</h3>
                <WaveformDisplay_080 
                  color="#0EA5E9" 
                  data={ecgWaveformChunk} 
                  minY={ecgMinY} 
                  maxY={ecgMaxY} 
                  height={250}
                  speed={8}
                  stepX={ecgStepX}
                  smoothingWindow={1}
                  isPlaying={isPlaying}
                />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
