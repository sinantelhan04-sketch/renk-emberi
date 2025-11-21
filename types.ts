
export enum ColorType {
  RED = '#EF4444',    // Tailwind red-500
  BLUE = '#3B82F6',   // Tailwind blue-500
  GREEN = '#22C55E',  // Tailwind green-500
  YELLOW = '#EAB308'  // Tailwind yellow-500
}

export type ShapeType = 'circle' | 'square' | 'hexagon' | 'diamond' | 'star';

export interface Ball {
  id: number;
  y: number;
  color: ColorType;
  radius: number;
  speed: number;
  shape: ShapeType;
}

export interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
  size: number;
  shape: 'circle' | 'square' | 'line' | 'shockwave'; // Added shockwave
}

export interface Star {
  x: number;
  y: number;
  size: number;
  speed: number;
  alpha: number;
}

export interface GameState {
  isPlaying: boolean;
  isGameOver: boolean;
  score: number;
  highScore: number;
  level: number;
}

export const WHEEL_COLORS = [
  ColorType.RED,
  ColorType.BLUE,
  ColorType.GREEN,
  ColorType.YELLOW
];