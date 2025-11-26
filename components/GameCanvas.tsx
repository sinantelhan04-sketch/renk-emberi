import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ColorType, Ball, GameState, WHEEL_COLORS, Particle, Star, ShapeType, FloatingText } from '../types';
import { GAME_CONFIG, SEGMENT_ORDER, PARTICLE_CONFIG, SCORE_VALUES } from '../constants';

interface GameCanvasProps {
  gameState: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  onGameOver: () => void;
  isMuted: boolean;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ gameState, setGameState, onGameOver, isMuted }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // --- OYUN NESNELERİ ---
  const ballsRef = useRef<Ball[]>([]);
  const particlesRef = useRef<Particle[]>([]); // Patlama efektleri için
  const floatingTextsRef = useRef<FloatingText[]>([]); // Uçan puan yazıları için
  const starsRef = useRef<Star[]>([]); // Arka plan efektleri için
  
  // --- DURUM REFLERİ ---
  const wheelRotationIndexRef = useRef<number>(0); // Mantıksal hedef (0-3)
  const visualRotationRef = useRef<number>(0); // Görsel anlık açı (Radyan)
  const targetRotationRef = useRef<number>(0); // Hedef açı (Radyan)
  const scaleRef = useRef<number>(1); // Vuruş efekti için ölçek (Pulse)
  const rotationVelocityRef = useRef<number>(0); // Dönüş hızı (Yay fiziği için)
  
  // Oyun döngüsü içinde güncel skoru takip etmek için Ref kullanıyoruz
  const scoreRef = useRef<number>(0);
  const highScoreRef = useRef<number>(gameState.highScore); // Başlangıçtaki rekoru tut
  const hasTriggeredConfettiRef = useRef<boolean>(false); // Rekor kutlaması yapıldı mı?
  
  const lastSpawnTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number>(0);
  const currentSpeedRef = useRef<number>(GAME_CONFIG.INITIAL_SPEED);
  const totalTimePlayedRef = useRef<number>(0); // Tracks time played in current session for speed ramp
  
  // Slow Motion State
  const speedMultiplierRef = useRef<number>(1.0);
  const slowMotionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track previous states for reset detection
  const prevIsGameOver = useRef(gameState.isGameOver);
  const prevIsPlaying = useRef(gameState.isPlaying);

  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });

  // --- SES SİSTEMİ (Web Audio API) ---
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Score Ref'i State ile senkronize et
  useEffect(() => {
    scoreRef.current = gameState.score;
  }, [gameState.score]);
  
  // HighScore prop değişirse ref'i güncelle (ancak oyun sırasında confetti mantığı için init değer önemli)
  useEffect(() => {
     // Sadece oyun başında veya restartta high score referansını güncellemek mantıklı, 
     // ancak App.tsx high score'u oyun bitince güncelliyor. 
     // Biz oyun İÇİNDE rekor kırılmasını kontrol edeceğimiz için 
     // component mount olduğunda veya oyun başladığında bu değeri kilitliyoruz (aşağıdaki reset bloğunda).
  }, [gameState.highScore]);

  useEffect(() => {
    // AudioContext'i başlat (Tarayıcı desteği ile)
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtxRef.current = new AudioContextClass();
    }
    
    return () => {
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close();
      }
    };
  }, []);

  const playSound = useCallback((type: 'score' | 'gameover' | 'freeze' | 'levelup') => {
    if (isMuted || !audioCtxRef.current) return;

    const ctx = audioCtxRef.current;
    
    // Eğer context askıdaysa (suspended), uyandırmayı dene
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    const now = ctx.currentTime;
    const currentScore = scoreRef.current;
    const currentLevel = Math.floor(currentScore / 10) + 1;

    if (type === 'freeze') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.linearRampToValueAtTime(800, now + 0.5);
        gainNode.gain.setValueAtTime(0.5, now);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
    } else if (type === 'levelup') {
        // Konfeti / Rekor sesi
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.linearRampToValueAtTime(800, now + 0.1);
        osc.frequency.linearRampToValueAtTime(1200, now + 0.2);
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.6);
        osc.start(now);
        osc.stop(now + 0.6);
    } else if (type === 'score') {
      if (currentLevel < 4) {
        osc.type = 'triangle';
        const freq = 600 + (Math.random() * 100); 
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.5, now + 0.1);
        gainNode.gain.setValueAtTime(0.8, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
      } else if (currentLevel < 8) {
        osc.type = 'sawtooth';
        const freq = 800 - ((currentScore % 10) * 20); 
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.15);
        gainNode.gain.setValueAtTime(0.5, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      } else {
        osc.type = 'square';
        const freq = 200 + (Math.random() * 50);
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.linearRampToValueAtTime(freq * 2, now + 0.05); 
        gainNode.gain.setValueAtTime(0.4, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
      }
    } else if (type === 'gameover') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(10, now + 1.0);
      gainNode.gain.setValueAtTime(0.7, now);
      gainNode.gain.linearRampToValueAtTime(0.001, now + 1.0);
      osc.start(now);
      osc.stop(now + 1.0);
    }
  }, [isMuted]);

  // Resize Handler
  useEffect(() => {
    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    
    // Arka plan yıldızlarını başlat
    const initStars = () => {
        const stars: Star[] = [];
        for(let i=0; i<50; i++) {
            stars.push({
                x: Math.random() * window.innerWidth,
                y: Math.random() * window.innerHeight,
                size: Math.random() * 2 + 0.5,
                speed: Math.random() * 0.5 + 0.1,
                alpha: Math.random() * 0.5 + 0.1
            });
        }
        starsRef.current = stars;
    };
    initStars();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Çemberi Döndür
  const rotateWheel = useCallback((amount: number = 1) => {
    if (!gameState.isPlaying || gameState.isGameOver) return;
    
    if (audioCtxRef.current?.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
    }

    wheelRotationIndexRef.current = (wheelRotationIndexRef.current + amount + 4) % 4;
    targetRotationRef.current += amount * (Math.PI / 2);
  }, [gameState.isPlaying, gameState.isGameOver]);

  // Input Handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        rotateWheel(1);
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
        const target = e.target as HTMLElement;
        if (target.tagName === 'BUTTON' || target.closest('button')) return;

        if (!gameState.isPlaying || gameState.isGameOver) return;

        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = dimensions.width / 2;
        const centerY = dimensions.height / 2 + 80;

        const dx = x - centerX;
        const dy = y - centerY;
        const dist = Math.sqrt(dx*dx + dy*dy);

        if (dist < GAME_CONFIG.WHEEL_RADIUS * 1.6) {
             let angle = Math.atan2(dy, dx) * (180 / Math.PI);
             if (angle < 0) angle += 360;
             
             let clickedQuadrant = 0; 
             
             if (angle >= 45 && angle < 135) clickedQuadrant = 2; // Alt
             else if (angle >= 135 && angle < 225) clickedQuadrant = 3; // Sol
             else if (angle >= 225 && angle < 315) clickedQuadrant = 0; // Üst
             else clickedQuadrant = 1; // Sağ (Diğer tüm durumlar)
             
             let rotationAmount = 0;
             
             if (clickedQuadrant === 1) rotationAmount = -1; // Sağ -> Sol Dönüş
             else if (clickedQuadrant === 3) rotationAmount = 1; // Sol -> Sağ Dönüş
             else if (clickedQuadrant === 2) rotationAmount = 2; // Alt -> Tam Dönüş

             if (rotationAmount !== 0) {
                 rotateWheel(rotationAmount);
             }
        } else {
            rotateWheel(1);
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointerdown', handlePointerDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [rotateWheel, gameState.isPlaying, gameState.isGameOver, dimensions]);

  // Oyunu Sıfırla / Başlat
  useEffect(() => {
    const isRestart = (prevIsGameOver.current === true && gameState.isGameOver === false);
    const isStart = (prevIsPlaying.current === false && gameState.isPlaying === true);

    if (isRestart || isStart) {
      ballsRef.current = [];
      particlesRef.current = [];
      floatingTextsRef.current = [];
      
      // SADECE level 1'den başlanıyorsa (Tam Reset) çarkı sıfırla.
      if (gameState.level === 1) {
          wheelRotationIndexRef.current = 0;
          visualRotationRef.current = 0;
          targetRotationRef.current = 0;
          highScoreRef.current = gameState.highScore; // Rekor takibini resetle
          hasTriggeredConfettiRef.current = false; // Konfeti durumunu resetle
      } else {
          // Continue durumunda hedef açıyı görsel açıya eşitle
          targetRotationRef.current = visualRotationRef.current;
      }

      lastSpawnTimeRef.current = performance.now();
      rotationVelocityRef.current = 0;
      speedMultiplierRef.current = 1.0;
      if (slowMotionTimeoutRef.current) clearTimeout(slowMotionTimeoutRef.current);
      
      currentSpeedRef.current = GAME_CONFIG.INITIAL_SPEED;
      totalTimePlayedRef.current = 0;
      
      if (audioCtxRef.current?.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
    }

    prevIsGameOver.current = gameState.isGameOver;
    prevIsPlaying.current = gameState.isPlaying;
  }, [gameState.isPlaying, gameState.isGameOver, gameState.score, gameState.level, gameState.highScore]);

  // Yardımcı: Parçacık Patlaması
  const createExplosion = (x: number, y: number, color: string) => {
    const currentLevel = Math.floor(scoreRef.current / 10) + 1;
    
    let particleShape: 'circle' | 'square' | 'line' = 'circle';
    if (currentLevel >= 4 && currentLevel < 8) particleShape = 'square';
    if (currentLevel >= 8) particleShape = 'line';

    for (let i = 0; i < PARTICLE_CONFIG.COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * (PARTICLE_CONFIG.SPEED_MAX - PARTICLE_CONFIG.SPEED_MIN) + PARTICLE_CONFIG.SPEED_MIN;
      
      particlesRef.current.push({
        id: Math.random(),
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        alpha: 1,
        size: Math.random() * (PARTICLE_CONFIG.SIZE_MAX - PARTICLE_CONFIG.SIZE_MIN) + PARTICLE_CONFIG.SIZE_MIN,
        shape: particleShape
      });
    }
  };

  // Yardımcı: Konfeti Patlaması
  const createConfettiExplosion = () => {
      const colors = ['#f472b6', '#38bdf8', '#facc15', '#4ade80', '#ffffff'];
      for (let i = 0; i < 100; i++) {
          const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI; // Yukarı doğru yelpaze
          const speed = Math.random() * 10 + 5;
          particlesRef.current.push({
              id: Math.random(),
              x: dimensions.width / 2,
              y: dimensions.height / 2 + 50,
              vx: Math.cos(angle) * speed * (Math.random() + 0.5),
              vy: Math.sin(angle) * speed - 5,
              color: colors[Math.floor(Math.random() * colors.length)],
              alpha: 1,
              size: Math.random() * 6 + 4,
              shape: 'confetti',
              rotation: Math.random() * 360,
              rotationSpeed: (Math.random() - 0.5) * 10
          });
      }
  };

  // Yardımcı: Uçan Yazı Efekti
  const createFloatingText = (x: number, y: number, text: string, color: string, fontSize: number = 24) => {
    floatingTextsRef.current.push({
      id: Math.random(),
      x,
      y,
      text,
      alpha: 1,
      vy: -2, // Yukarı süzülme
      color,
      size: fontSize
    });
  };

  // Yardımcı: Çember Patlaması
  const createWheelExplosion = (centerX: number, centerY: number) => {
      particlesRef.current.push({
          id: Math.random(),
          x: centerX,
          y: centerY,
          vx: 0,
          vy: 0,
          color: 'white',
          alpha: 1,
          size: GAME_CONFIG.WHEEL_RADIUS, 
          shape: 'shockwave'
      });

      SEGMENT_ORDER.forEach((color, index) => {
          const baseAngle = (index * 90 - 90) * (Math.PI / 180);
          for(let i=0; i<50; i++) {
              const currentRotation = visualRotationRef.current;
              const segmentAngle = baseAngle + currentRotation;
              const spread = (Math.random() - 0.5) * Math.PI; 
              const angle = segmentAngle + spread;
              const speed = Math.random() * 15 + 5; 
              const startDist = Math.random() * 40 + 20;
              
              particlesRef.current.push({
                  id: Math.random(),
                  x: centerX + Math.cos(angle) * startDist,
                  y: centerY + Math.sin(angle) * startDist,
                  vx: Math.cos(angle) * speed,
                  vy: Math.sin(angle) * speed,
                  color: color,
                  alpha: 1,
                  size: Math.random() * 8 + 2, 
                  shape: Math.random() > 0.5 ? 'square' : 'line'
              });
          }
      });
  };

  // Slow Motion Helper
  const triggerSlowMotion = () => {
      speedMultiplierRef.current = GAME_CONFIG.SLOW_MOTION_FACTOR;
      playSound('freeze');
      
      if (slowMotionTimeoutRef.current) clearTimeout(slowMotionTimeoutRef.current);
      
      slowMotionTimeoutRef.current = setTimeout(() => {
          speedMultiplierRef.current = 1.0;
      }, GAME_CONFIG.SLOW_MOTION_DURATION);
  };

  // --- ANA OYUN DÖNGÜSÜ ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d'); 
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = `${dimensions.width}px`;
    canvas.style.height = `${dimensions.height}px`;

    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2 + 80;

    const TENSION = 0.15; 
    const FRICTION = 0.65; 

    // Render loop için son zamanı tut
    let lastTime = performance.now();

    const render = (time: number) => {
      const deltaTime = time - lastTime;
      lastTime = time;

      ctx.clearRect(0, 0, dimensions.width, dimensions.height);

      starsRef.current.forEach(star => {
        star.y += star.speed;
        if (star.y > dimensions.height) star.y = 0; 
        ctx.globalAlpha = star.alpha;
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      });

      if (!gameState.isPlaying && !gameState.isGameOver && ballsRef.current.length === 0) {
             visualRotationRef.current += 0.005;
             drawWheel(ctx, centerX, centerY, visualRotationRef.current, 1);
             animationFrameRef.current = requestAnimationFrame(render);
             return; 
      }

      const diff = targetRotationRef.current - visualRotationRef.current;
      rotationVelocityRef.current += diff * TENSION;
      rotationVelocityRef.current *= FRICTION;
      visualRotationRef.current += rotationVelocityRef.current;
      
      const velocityStretch = Math.min(Math.abs(rotationVelocityRef.current) * 0.1, 0.05);
      const dynamicScale = scaleRef.current - velocityStretch;

      scaleRef.current += (1 - scaleRef.current) * 0.15;

      if (gameState.isPlaying && !gameState.isGameOver) {
        // --- ZAMAN BAZLI HIZ ARTIŞI ---
        totalTimePlayedRef.current += deltaTime;
        const speedIncrease = (totalTimePlayedRef.current / 1000) * 0.05;
        currentSpeedRef.current = GAME_CONFIG.INITIAL_SPEED + speedIncrease;

        // --- SPAWN LOGIC: TOP BİTİNCE YENİSİ GELSİN (Sequential) ---
        if (ballsRef.current.length === 0) {
            const randomColor = WHEEL_COLORS[Math.floor(Math.random() * WHEEL_COLORS.length)];
            const shapes: ShapeType[] = ['circle', 'square', 'hexagon', 'diamond', 'star'];
            
            // %8 şansla Kar Tanesi (Yavaşlatıcı) topu gelsin
            let randomShape: ShapeType;
            if (Math.random() < 0.08) {
                randomShape = 'snowflake';
            } else {
                randomShape = shapes[Math.floor(Math.random() * shapes.length)];
            }

            ballsRef.current.push({
              id: time,
              y: -50,
              color: randomColor,
              radius: GAME_CONFIG.BALL_RADIUS,
              speed: currentSpeedRef.current,
              shape: randomShape
            });
            lastSpawnTimeRef.current = time;
        }
      }

      const hitY = centerY - GAME_CONFIG.WHEEL_RADIUS - GAME_CONFIG.BALL_RADIUS + 5; 

      for (let i = ballsRef.current.length - 1; i >= 0; i--) {
        const ball = ballsRef.current[i];
        
        ball.y += ball.speed * speedMultiplierRef.current;

        if (ball.y >= hitY) {
          const topColorIndex = (0 - wheelRotationIndexRef.current + 4) % 4;
          const activeColor = SEGMENT_ORDER[topColorIndex];

          const isMatch = ball.color === activeColor || ball.shape === 'snowflake';

          if (isMatch) {
            createExplosion(centerX, hitY + GAME_CONFIG.BALL_RADIUS, ball.shape === 'snowflake' ? '#22d3ee' : ball.color);
            playSound('score'); 
            
            const points = SCORE_VALUES[ball.shape];

            if (ball.shape === 'snowflake') {
                triggerSlowMotion();
                createFloatingText(centerX, hitY, "FREEZE!", '#22d3ee', 36);
            } else {
                createFloatingText(centerX, hitY, `+${points}`, ball.color, points > 2 ? 32 : 24);
            }
            
            // Puanı güncelle
            setGameState(prev => {
              const newScore = prev.score + points;
              const newLevel = Math.floor(newScore / 10) + 1;
              
              // REKOR KONTROLÜ
              if (newScore > highScoreRef.current && !hasTriggeredConfettiRef.current && highScoreRef.current > 0) {
                  hasTriggeredConfettiRef.current = true;
                  createConfettiExplosion();
                  createFloatingText(centerX, centerY - 50, "YENİ REKOR!", '#fbbf24', 40);
                  playSound('levelup');
              }

              return { ...prev, score: newScore, level: newLevel };
            });

            ballsRef.current.splice(i, 1);
            scaleRef.current = 1.2; 

          } else {
            if (gameState.isPlaying && !gameState.isGameOver) {
                playSound('gameover'); 
                createWheelExplosion(centerX, centerY); 
                onGameOver();
                if (slowMotionTimeoutRef.current) clearTimeout(slowMotionTimeoutRef.current);
            }
             ballsRef.current.splice(i, 1); 
            return; 
          }
        } else {
          drawBall(ctx, centerX, ball);
        }
      }

      // Render Floating Texts
      for (let i = floatingTextsRef.current.length - 1; i >= 0; i--) {
          const ft = floatingTextsRef.current[i];
          ft.y += ft.vy;
          ft.alpha -= 0.02;

          if (ft.alpha <= 0) {
              floatingTextsRef.current.splice(i, 1);
          } else {
              ctx.save();
              ctx.globalAlpha = ft.alpha;
              ctx.font = `900 ${ft.size}px 'Inter', sans-serif`;
              ctx.fillStyle = ft.color;
              ctx.shadowColor = 'black';
              ctx.shadowBlur = 4;
              ctx.textAlign = 'center';
              ctx.fillText(ft.text, ft.x, ft.y);
              ctx.strokeStyle = 'white';
              ctx.lineWidth = 1;
              ctx.strokeText(ft.text, ft.x, ft.y);
              ctx.restore();
          }
      }

      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        
        if (p.shape === 'shockwave') {
             p.size += 15; 
             p.alpha -= 0.03;
        } else if (p.shape === 'confetti') {
            // Konfeti Fiziği
            p.x += p.vx;
            p.y += p.vy;
            p.vy += PARTICLE_CONFIG.GRAVITY * 0.5; // Daha hafif yerçekimi
            p.vx *= 0.96; // Sürtünme
            p.rotation = (p.rotation || 0) + (p.rotationSpeed || 5);
            p.alpha -= 0.005; // Yavaşça yok ol
        } else {
             p.x += p.vx;
             p.y += p.vy;
             p.vy += PARTICLE_CONFIG.GRAVITY; 
             p.alpha -= PARTICLE_CONFIG.DECAY;
        }

        if (p.alpha <= 0) {
          particlesRef.current.splice(i, 1);
        } else {
          ctx.save();
          
          if (p.shape === 'shockwave') {
             ctx.beginPath();
             ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
             ctx.strokeStyle = `rgba(255, 255, 255, ${p.alpha})`;
             ctx.lineWidth = 50 * p.alpha; 
             ctx.stroke();
          } else if (p.shape === 'confetti') {
             ctx.translate(p.x, p.y);
             ctx.rotate((p.rotation || 0) * Math.PI / 180);
             ctx.fillStyle = p.color;
             ctx.globalAlpha = p.alpha;
             // Sallanma efekti
             const sway = Math.cos(time * 0.01 + p.id * 10) * 0.5 + 1;
             ctx.fillRect(-p.size/2 * sway, -p.size/2, p.size * sway, p.size);
          } else {
              ctx.globalAlpha = p.alpha;
              ctx.fillStyle = p.color;
              
              if (p.shape === 'square') {
                 ctx.translate(p.x, p.y);
                 ctx.rotate(p.alpha * 10); 
                 ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
                 ctx.translate(-p.x, -p.y); 
              } else if (p.shape === 'line') {
                 const angle = Math.atan2(p.vy, p.vx);
                 const len = p.size * 3;
                 ctx.translate(p.x, p.y);
                 ctx.rotate(angle);
                 ctx.beginPath();
                 ctx.moveTo(0, 0);
                 ctx.lineTo(len, 0);
                 ctx.lineWidth = 2;
                 ctx.strokeStyle = p.color;
                 ctx.stroke();
                 ctx.translate(-p.x, -p.y); 
              } else {
                 ctx.beginPath();
                 ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                 ctx.fill();
              }
          }
          ctx.restore();
        }
      }

      if (!gameState.isGameOver) {
        drawWheel(ctx, centerX, centerY, visualRotationRef.current, dynamicScale);
        drawTargetIndicator(ctx, centerX, centerY - GAME_CONFIG.WHEEL_RADIUS - 15);
      }

      if ((gameState.isPlaying) || particlesRef.current.length > 0 || floatingTextsRef.current.length > 0) {
        animationFrameRef.current = requestAnimationFrame(render);
      }
    };

    animationFrameRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameRef.current);
  }, [dimensions, gameState.isPlaying, gameState.isGameOver, onGameOver, setGameState, playSound]);


  // --- ÇİZİM FONKSİYONLARI ---
  const drawTargetIndicator = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
      const currentLevel = Math.floor(scoreRef.current / 10) + 1;
      ctx.save();
      ctx.translate(x, y);
      ctx.beginPath();
      ctx.moveTo(-10, -8);
      ctx.lineTo(0, 4);
      ctx.lineTo(10, -8);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 4;
      if (currentLevel >= 8) ctx.strokeStyle = '#e0f2fe'; 
      else if (currentLevel >= 4) ctx.strokeStyle = '#e2e8f0'; 
      else ctx.strokeStyle = 'white'; 
      ctx.shadowBlur = 15;
      ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#94a3b8';
      ctx.shadowBlur = 0;
      ctx.stroke();
      ctx.restore();
  };

  const drawWheel = (ctx: CanvasRenderingContext2D, x: number, y: number, rotationRad: number, scale: number) => {
    const currentLevel = Math.floor(scoreRef.current / 10) + 1;
    
    // Level Aralığına Göre Şekil Belirleme
    let shapeType: 'circle' | 'square' | 'hexagon' | 'octagon' | 'star' = 'circle';
    if (currentLevel > 40) shapeType = 'star';
    else if (currentLevel > 30) shapeType = 'octagon';
    else if (currentLevel > 20) shapeType = 'hexagon';
    else if (currentLevel > 10) shapeType = 'square';
    else shapeType = 'circle';

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale); 
    ctx.rotate(rotationRad);

    const outerRadius = GAME_CONFIG.WHEEL_RADIUS;
    const innerRadius = GAME_CONFIG.WHEEL_RADIUS * 0.55; 

    // --- 1. ADIM: ŞEKİL KLİPLEME ---
    // Önce dış şekli çiz ve clip() uygula. Böylece renkleri basitçe dikdörtgen olarak çizebiliriz.
    ctx.beginPath();
    drawShapePath(ctx, shapeType, outerRadius);
    ctx.clip(); // Artık sadece bu şeklin içine çizim yapılacak

    // --- 2. ADIM: RENK DİLİMLERİ ---
    // 4 Rengi basitçe 4 büyük kare/dilim olarak çiziyoruz. Clip sayesinde şekle oturacak.
    SEGMENT_ORDER.forEach((color, index) => {
        ctx.beginPath();
        // Basit quadrant çizimi (0, 90, 180, 270 derece yönünde)
        // Her dilim çeyrek alanı kapsasın
        const startAngle = (index * 90 - 135) * (Math.PI / 180);
        const endAngle = (index * 90 - 45) * (Math.PI / 180);
        
        ctx.moveTo(0,0);
        ctx.arc(0, 0, outerRadius * 2, startAngle, endAngle); // Radius * 2 garanti olsun diye
        ctx.fillStyle = color;
        ctx.fill();
    });

    // Parlama Efektleri (Shape'e özel)
    if (shapeType !== 'circle') {
       ctx.strokeStyle = 'rgba(255,255,255,0.2)';
       ctx.lineWidth = 2;
       drawShapePath(ctx, shapeType, outerRadius); // Kenar çizgisi
       ctx.stroke();
    } else {
        // Daire için klasik efektler
        if (currentLevel >= 4) {
             ctx.beginPath();
             ctx.arc(0, 0, outerRadius - 2, 0, Math.PI * 2);
             ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
             ctx.lineWidth = 2;
             ctx.stroke();
        }
    }

    // --- 3. ADIM: İÇ BOŞLUK (CORE) ---
    // Core da şekle uygun olsun
    ctx.globalCompositeOperation = 'source-over'; // Normal moda dön (clip hala aktif olabilir)
    ctx.beginPath();
    
    // İç şekil, dış şeklin küçüğü
    drawShapePath(ctx, shapeType, innerRadius);
    ctx.fillStyle = '#020617'; // Arkaplan rengiyle "delik" aç
    ctx.fill();

    // Core Dekorasyonu
    if (shapeType !== 'circle') {
        // Geometrik Core Efektleri
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#f472b6'; 
        ctx.strokeStyle = '#f472b6';
        ctx.lineWidth = 3;
        drawShapePath(ctx, shapeType, innerRadius - 5);
        ctx.stroke();
        ctx.shadowBlur = 0;
    } else {
        // Klasik Daire Core Efektleri
        if (currentLevel >= 8) {
             const coreGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, 15);
             coreGrad.addColorStop(0, 'white');
             coreGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
             ctx.fillStyle = coreGrad;
             ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(0, 0, innerRadius - 8, 0, Math.PI * 2);
        ctx.strokeStyle = currentLevel >= 4 ? '#475569' : 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    ctx.restore();
  };

  // Yardımcı: Geometrik Şekil Yolları Çizici
  const drawShapePath = (ctx: CanvasRenderingContext2D, type: string, r: number) => {
      if (type === 'circle') {
          ctx.arc(0, 0, r, 0, Math.PI * 2);
      } else if (type === 'square') {
          ctx.rect(-r, -r, r * 2, r * 2);
      } else if (type === 'hexagon') {
          for (let i = 0; i < 6; i++) {
              const angle = (Math.PI / 3) * i;
              const x = r * Math.cos(angle);
              const y = r * Math.sin(angle);
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
          }
          ctx.closePath();
      } else if (type === 'octagon') {
          for (let i = 0; i < 8; i++) {
              const angle = (Math.PI / 4) * i - Math.PI / 8; // 22.5 derece offset ile düz durur
              const x = r * 1.1 * Math.cos(angle); // Biraz scale up
              const y = r * 1.1 * Math.sin(angle);
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
          }
          ctx.closePath();
      } else if (type === 'star') {
          const spikes = 4;
          const outer = r * 1.2;
          const inner = r * 0.5;
          let rot = -Math.PI / 2;
          const step = Math.PI / spikes;
          ctx.moveTo(0, 0 - outer);
          for (let i = 0; i < spikes; i++) {
              let x = Math.cos(rot) * outer;
              let y = Math.sin(rot) * outer;
              ctx.lineTo(x, y);
              rot += step;
              x = Math.cos(rot) * inner;
              y = Math.sin(rot) * inner;
              ctx.lineTo(x, y);
              rot += step;
          }
          ctx.closePath();
      }
  };

  const drawBall = (ctx: CanvasRenderingContext2D, x: number, ball: Ball) => {
    ctx.save();
    
    // Draw ball trail or body
    if (ball.shape === 'snowflake') {
         // Özel Snowflake Glow
         ctx.shadowBlur = 20;
         ctx.shadowColor = '#22d3ee'; // Cyan glow
    } else {
         ctx.shadowBlur = 10;
         ctx.shadowColor = ball.color;
    }

    // Gradient Trail
    const tailLength = ball.speed * 2;
    const gradient = ctx.createLinearGradient(x, ball.y - tailLength, x, ball.y);
    gradient.addColorStop(0, 'rgba(255,255,255,0)');
    gradient.addColorStop(1, ball.shape === 'snowflake' ? '#22d3ee' : ball.color);
    ctx.beginPath();
    ctx.moveTo(x - ball.radius * 0.6, ball.y);
    ctx.lineTo(x, ball.y - tailLength);
    ctx.lineTo(x + ball.radius * 0.6, ball.y);
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.globalAlpha = 1.0;

    ctx.beginPath();
    ctx.fillStyle = ball.shape === 'snowflake' ? '#ecfeff' : ball.color;

    if (ball.shape === 'square') {
        const size = ball.radius * 2;
        const r = ball.radius * 0.4; 
        const bx = x - ball.radius;
        const by = ball.y - ball.radius;
        ctx.moveTo(bx + r, by);
        ctx.lineTo(bx + size - r, by);
        ctx.quadraticCurveTo(bx + size, by, bx + size, by + r);
        ctx.lineTo(bx + size, by + size - r);
        ctx.quadraticCurveTo(bx + size, by + size, bx + size - r, by + size);
        ctx.lineTo(bx + r, by + size);
        ctx.quadraticCurveTo(bx, by + size, bx, by + size - r);
        ctx.lineTo(bx, by + r);
        ctx.quadraticCurveTo(bx, by, bx + r, by);
    } else if (ball.shape === 'hexagon') {
        const r = ball.radius * 1.15; 
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i - Math.PI / 6; 
            const px = x + r * Math.cos(angle);
            const py = ball.y + r * Math.sin(angle);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
    } else if (ball.shape === 'diamond') {
        const r = ball.radius * 1.2; 
        ctx.moveTo(x, ball.y - r); 
        ctx.lineTo(x + r, ball.y); 
        ctx.lineTo(x, ball.y + r); 
        ctx.lineTo(x - r, ball.y); 
        ctx.closePath();
    } else if (ball.shape === 'star') {
        const spikes = 5;
        const outerRadius = ball.radius * 1.3;
        const innerRadius = ball.radius * 0.6;
        let rot = Math.PI / 2 * 3;
        let cx = x;
        let cy = ball.y;
        let step = Math.PI / spikes;
        ctx.moveTo(cx, cy - outerRadius);
        for (let i = 0; i < spikes; i++) {
            cx = x + Math.cos(rot) * outerRadius;
            cy = ball.y + Math.sin(rot) * outerRadius;
            ctx.lineTo(cx, cy);
            rot += step;
            cx = x + Math.cos(rot) * innerRadius;
            cy = ball.y + Math.sin(rot) * innerRadius;
            ctx.lineTo(cx, cy);
            rot += step;
        }
        ctx.lineTo(x, ball.y - outerRadius);
        ctx.closePath();
    } else if (ball.shape === 'snowflake') {
        // Kar Tanesi Çizimi
        const spikes = 8;
        const outerRadius = ball.radius * 1.2;
        const innerRadius = ball.radius * 0.3;
        
        // Çarpı Kolları
        for (let i = 0; i < 4; i++) {
             ctx.save();
             ctx.translate(x, ball.y);
             ctx.rotate((Math.PI / 4) * i);
             ctx.fillStyle = '#22d3ee';
             ctx.fillRect(-2, -outerRadius, 4, outerRadius * 2);
             
             // Uçlara toplar
             ctx.beginPath();
             ctx.arc(0, -outerRadius, 3, 0, Math.PI*2);
             ctx.arc(0, outerRadius, 3, 0, Math.PI*2);
             ctx.fillStyle = 'white';
             ctx.fill();
             ctx.restore();
        }
        // Merkez
        ctx.beginPath();
        ctx.arc(x, ball.y, innerRadius, 0, Math.PI*2);
        ctx.fillStyle = 'white';
    } else {
        ctx.arc(x, ball.y, ball.radius, 0, Math.PI * 2);
    }
    
    // Snowflake zaten dolduruldu, diğerleri için fill
    if (ball.shape !== 'snowflake') {
        ctx.fill();
    }
    
    ctx.shadowBlur = 0;
    
    // Shine / Highlight
    ctx.beginPath();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    if (ball.shape === 'square') {
         ctx.arc(x - ball.radius * 0.4, ball.y - ball.radius * 0.4, 3, 0, Math.PI * 2);
    } else if (ball.shape === 'star') {
         ctx.arc(x - 2, ball.y - 4, 2, 0, Math.PI * 2);
    } else if (ball.shape !== 'snowflake') {
         ctx.arc(x - 3, ball.y - 3, 3, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.restore();
  };

  return (
    <canvas 
      ref={canvasRef} 
      className="block touch-none"
    />
  );
};

export default GameCanvas;