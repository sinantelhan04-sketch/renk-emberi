import { ColorType } from './types';

export const GAME_CONFIG = {
  WHEEL_RADIUS: 115,
  BALL_RADIUS: 14,
  INITIAL_SPEED: 3.0,
  SPEED_INCREMENT: 0.15,
  SPAWN_RATE_MS: 1800, 
  MIN_SPAWN_RATE_MS: 500, 
  ROTATION_SPEED: 0.2, // Lerp katsayısı (Daha düşük = daha yavaş, daha yumuşak)
};

export const PARTICLE_CONFIG = {
  COUNT: 20, // Patlama başına parçacık sayısı
  DECAY: 0.02, // Solma hızı
  SPEED_MIN: 2,
  SPEED_MAX: 6,
  SIZE_MIN: 2,
  SIZE_MAX: 5,
  GRAVITY: 0.15
};

// Renklerin çemberdeki sırası (Saat yönünde)
export const SEGMENT_ORDER = [
  ColorType.RED,    // 0: Üst
  ColorType.BLUE,   // 1: Sağ
  ColorType.GREEN,  // 2: Alt
  ColorType.YELLOW  // 3: Sol
];