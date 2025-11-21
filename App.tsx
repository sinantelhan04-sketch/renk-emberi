import React, { useState, useEffect, useRef } from 'react';
import GameCanvas from './components/GameCanvas';
import { GameState } from './types';
import { RotateCw, Trophy, Play, RotateCcw, Volume2, VolumeX, SkipForward } from 'lucide-react';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>({
    isPlaying: false,
    isGameOver: false,
    score: 0,
    highScore: 0,
    level: 1
  });

  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showLevelUp, setShowLevelUp] = useState<boolean>(false);
  const prevLevelRef = useRef<number>(1);

  // Seviye Renk Temaları
  const LEVEL_THEMES = [
    'bg-slate-900',     // Level 1: Default (Dark Blue)
    'bg-indigo-950',    // Level 2: Deep Indigo
    'bg-rose-950',      // Level 3: Dark Red
    'bg-emerald-950',   // Level 4: Dark Green
    'bg-cyan-950',      // Level 5: Dark Cyan
    'bg-amber-950',     // Level 6: Dark Amber
    'bg-fuchsia-950',   // Level 7: Dark Fuchsia
  ];

  // Mevcut temayı belirle (Game Over ise Kırmızı, değilse level teması)
  const currentTheme = gameState.isGameOver 
    ? 'bg-red-950' // Kaza anında arka plan koyu kırmızı
    : (LEVEL_THEMES[(gameState.level - 1) % LEVEL_THEMES.length] || 'bg-slate-900');

  // LocalStorage'dan en yüksek skoru çek
  useEffect(() => {
    const savedScore = localStorage.getItem('colorMatchHighScore');
    if (savedScore) {
      setGameState(prev => ({ ...prev, highScore: parseInt(savedScore, 10) }));
    }
  }, []);

  // Oyun bitince en yüksek skoru kaydet
  useEffect(() => {
    if (gameState.isGameOver) {
      if (gameState.score > gameState.highScore) {
        setGameState(prev => ({ ...prev, highScore: gameState.score }));
        localStorage.setItem('colorMatchHighScore', gameState.score.toString());
      }
    }
  }, [gameState.isGameOver, gameState.score, gameState.highScore]);

  // Level Atlandığını İzle
  useEffect(() => {
    if (gameState.level > prevLevelRef.current) {
       setShowLevelUp(true);
       const timer = setTimeout(() => setShowLevelUp(false), 2000);
       
       prevLevelRef.current = gameState.level;
       return () => clearTimeout(timer);
    }
  }, [gameState.level]);

  // Oyun Resetlendiğinde Durumu Temizle
  useEffect(() => {
    if (gameState.score === 0 && gameState.level === 1) {
        prevLevelRef.current = 1;
        setShowLevelUp(false);
    }
  }, [gameState.score, gameState.level]);

  const restartGame = () => {
    setGameState(prev => ({
      ...prev,
      isPlaying: true,
      isGameOver: false,
      score: 0,
      level: 1
    }));
  };

  const continueLevel = () => {
    // Seviyenin taban puanını hesapla (Örn: Level 5 için 40)
    const baseScore = (gameState.level - 1) * 10;
    setGameState(prev => ({
      ...prev,
      isPlaying: true,
      isGameOver: false,
      score: baseScore,
      // level aynı kalır
    }));
  };

  const handleGameOver = () => {
    setGameState(prev => ({ ...prev, isGameOver: true }));
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const progress = (gameState.score % 10) * 10;
  
  return (
    <div className={`relative w-full h-screen ${currentTheme} flex flex-col items-center justify-center overflow-hidden select-none transition-colors duration-500 ease-in-out`}>
      
      <div className="absolute inset-0 z-0">
        <GameCanvas 
          gameState={gameState} 
          setGameState={setGameState}
          onGameOver={handleGameOver} 
          isMuted={isMuted}
        />
      </div>

      <button 
        onClick={toggleMute}
        className="absolute top-4 right-4 z-30 p-3 rounded-full bg-black/20 text-white hover:bg-black/40 transition-colors backdrop-blur-sm border border-white/10"
        aria-label={isMuted ? "Sesi Aç" : "Sesi Kapat"}
      >
        {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
      </button>

      {!gameState.isGameOver && (
        <div className="absolute left-6 md:left-10 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-5 animate-in slide-in-from-left-10 duration-500">
            <div className="flex flex-col items-center gap-1">
                <span className="text-xs md:text-sm font-bold text-white/60 uppercase tracking-widest [writing-mode:vertical-lr] rotate-180">SEVİYE</span>
                <span className="text-4xl md:text-5xl font-black text-white drop-shadow-md font-mono">{gameState.level}</span>
            </div>

            <div className="relative w-4 md:w-6 h-48 md:h-64 bg-black/40 rounded-full overflow-hidden backdrop-blur-sm border border-white/10 shadow-lg">
                <div 
                    className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-blue-500 via-purple-500 to-pink-500 transition-all duration-300 ease-out"
                    style={{ height: `${progress}%` }}
                ></div>
            </div>

            <div className="text-sm font-bold text-blue-200 opacity-90">
                %{progress}
            </div>
        </div>
      )}

      <div className="absolute top-8 z-10 flex flex-col items-center gap-1 pointer-events-none">
        <div className="text-6xl md:text-7xl font-black text-white drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)] opacity-90 tabular-nums tracking-tighter">
          {gameState.score}
        </div>
        
        <div className="text-xs font-semibold text-white/50 tracking-widest uppercase flex items-center gap-1 bg-black/30 px-3 py-1 rounded-full backdrop-blur-sm">
          <Trophy size={12} className="text-yellow-500" /> Rekor: {gameState.highScore}
        </div>
      </div>

      {showLevelUp && (
         <div className="absolute inset-0 z-40 pointer-events-none flex items-center justify-center flex-col animate-in zoom-in-50 fade-in duration-500">
            <h2 className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600 drop-shadow-[0_0_30px_rgba(234,179,8,0.8)] tracking-tighter animate-pulse">
               LEVEL UP!
            </h2>
            <div className="mt-4 text-2xl font-bold text-white bg-black/50 px-6 py-2 rounded-full backdrop-blur-md border border-yellow-500/50">
               SEVİYE {gameState.level}
            </div>
         </div>
      )}

      {!gameState.isPlaying && !gameState.isGameOver && (
        <div className="absolute inset-0 z-20 bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
          <div className="mb-8 relative">
             <div className="w-32 h-32 rounded-full border-8 border-slate-700 flex items-center justify-center animate-spin-slow">
                <RotateCw size={48} className="text-slate-500" />
             </div>
             <div className="absolute inset-0 flex items-center justify-center">
               <div className="w-4 h-4 bg-red-500 rounded-full absolute -top-2"></div>
               <div className="w-4 h-4 bg-blue-500 rounded-full absolute -right-2"></div>
               <div className="w-4 h-4 bg-green-500 rounded-full absolute -bottom-2"></div>
               <div className="w-4 h-4 bg-yellow-500 rounded-full absolute -left-2"></div>
             </div>
          </div>
          
          <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-blue-400 to-green-400 mb-2">
            RENK ÇARKI
          </h1>
          <p className="text-slate-300 mb-10 max-w-xs">
            Çemberdeki <span className="font-bold text-white bg-slate-700 px-2 py-0.5 rounded mx-1 text-sm border border-slate-600">Renge Tıkla</span> ve topu yakala!
          </p>
          
          <button 
            onClick={restartGame}
            className="group relative px-8 py-4 bg-white text-slate-900 font-bold text-xl rounded-full hover:bg-blue-50 transition-all active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.3)]"
          >
            <span className="flex items-center gap-2">
              <Play size={24} className="fill-slate-900" />
              OYUNA BAŞLA
            </span>
          </button>
        </div>
      )}

      {gameState.isGameOver && (
        <div className="absolute inset-0 z-20 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-in zoom-in-95 duration-500 delay-1000">
          <h2 className="text-4xl font-bold text-white mb-2">OYUN BİTTİ!</h2>
          <div className="text-8xl font-black text-red-500 mb-4 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)] tabular-nums">
            {gameState.score}
          </div>
          
          <div className="flex flex-col gap-2 mb-8 items-center">
             <div className="text-slate-400 text-sm">SKOR</div>
             <div className="text-2xl font-bold text-blue-400">{gameState.score}</div>
             
             {gameState.score >= gameState.highScore && gameState.score > 0 && (
               <span className="text-yellow-400 font-bold text-sm animate-pulse mt-2">
                 🏆 YENİ REKOR!
               </span>
             )}
          </div>

          <div className="flex flex-col gap-4 w-full max-w-xs">
            <button 
              onClick={continueLevel}
              className="group w-full px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg rounded-full transition-all active:scale-95 shadow-lg shadow-blue-900/50 flex items-center justify-center gap-2"
            >
                <SkipForward size={20} />
                DEVAM ET (LEVEL {gameState.level})
            </button>

            <button 
              onClick={restartGame}
              className="w-full px-6 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 font-semibold text-sm rounded-full transition-all flex items-center justify-center gap-2"
            >
                <RotateCcw size={16} />
                BAŞTAN BAŞLA (LEVEL 1)
            </button>
          </div>
        </div>
      )}
      
      <div className="absolute bottom-4 text-slate-500 text-xs font-medium opacity-50 pointer-events-none">
        Çembere Tıkla ve Döndür
      </div>

    </div>
  );
};

export default App;