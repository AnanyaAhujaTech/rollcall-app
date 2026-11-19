'use client';

import React, { useEffect, useRef } from 'react';
import { createNoise3D } from 'simplex-noise';

export interface VortexProps {
  children?: React.ReactNode;
  className?: string;
  containerClassName?: string;
  particleCount?: number;
  rangeY?: number;
  baseHue?: number;
  rangeHue?: number;
  baseSpeed?: number;
  rangeSpeed?: number;
  baseRadius?: number;
  rangeRadius?: number;
  backgroundColor?: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  ttl: number;
  speed: number;
  radius: number;
  hue: number;
}

export function Vortex({
  children,
  className = '',
  containerClassName = '',
  particleCount = 450,
  rangeY = 160,
  baseHue = 235,
  rangeHue = 45,
  baseSpeed = 0.05,
  rangeSpeed = 0.85,
  baseRadius = 1,
  rangeRadius = 2,
  backgroundColor = '#060918',
}: VortexProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const noise3D = createNoise3D();
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const prefersReducedMotion = mediaQuery.matches;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);
    let centerX = width / 2;
    let centerY = height / 2;
    let tick = 0;

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      centerX = width / 2;
      centerY = height / 2;
    };

    window.addEventListener('resize', handleResize);

    const initParticle = (): Particle => {
      // Distribute particles across canvas with bias towards center vortex
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * Math.max(width, height) * 0.7;
      const x = centerX + Math.cos(angle) * dist;
      const y = centerY + Math.sin(angle) * dist + (Math.random() - 0.5) * rangeY;

      const ttl = 180 + Math.random() * 240;
      const speed = baseSpeed + Math.random() * rangeSpeed;
      const radius = baseRadius + Math.random() * rangeRadius;
      const hue = baseHue + (Math.random() * 2 - 1) * rangeHue;

      return {
        x,
        y,
        vx: 0,
        vy: 0,
        life: Math.random() * ttl, // Stagger initial life
        ttl,
        speed,
        radius,
        hue,
      };
    };

    const particles: Particle[] = Array.from({ length: particleCount }, initParticle);

    // Initial clear
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    const render = () => {
      tick++;

      // Semi-transparent trailing clear
      ctx.fillStyle = 'rgba(6, 9, 24, 0.16)';
      ctx.fillRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Simplex noise curl combined with gentle inward vortex
        const dx = p.x - centerX;
        const dy = p.y - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        const noiseVal = noise3D(p.x * 0.0016, p.y * 0.0016, tick * 0.0004);
        const noiseAngle = noiseVal * Math.PI * 4;

        // Swirling vortex vector with slight inward pull
        const vortexAngle = Math.atan2(dy, dx) + Math.PI / 2 - 0.15;
        const blend = Math.min(1, Math.max(0, 1 - dist / (width * 0.8)));
        const finalAngle = vortexAngle * (0.55 + blend * 0.25) + noiseAngle * 0.35;

        p.vx = Math.cos(finalAngle) * p.speed;
        p.vy = Math.sin(finalAngle) * p.speed;

        p.x += p.vx;
        p.y += p.vy;
        p.life++;

        // Reset if expired or out of bounds
        if (
          p.life >= p.ttl ||
          p.x < -100 ||
          p.x > width + 100 ||
          p.y < -100 ||
          p.y > height + 100
        ) {
          const reset = initParticle();
          p.x = reset.x;
          p.y = reset.y;
          p.life = 0;
          p.ttl = reset.ttl;
          p.speed = reset.speed;
          p.radius = reset.radius;
          p.hue = reset.hue;
        }

        // Alpha calculation: smooth ease-in & ease-out
        const progress = p.life / p.ttl;
        const alpha = Math.sin(progress * Math.PI) * 0.75;

        // Draw particle
        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 85%, 68%, ${alpha})`;
        ctx.shadowColor = `hsla(${p.hue}, 90%, 65%, ${alpha * 0.8})`;
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.restore();
      }

      if (!prefersReducedMotion) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    if (prefersReducedMotion) {
      // Render single static frame for reduced motion preference
      render();
    } else {
      animationFrameId = requestAnimationFrame(render);
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [
    particleCount,
    rangeY,
    baseHue,
    rangeHue,
    baseSpeed,
    rangeSpeed,
    baseRadius,
    rangeRadius,
    backgroundColor,
  ]);

  return (
    <div
      ref={containerRef}
      className={`relative h-full w-full overflow-hidden ${containerClassName}`}
    >
      <canvas
        ref={canvasRef}
        className="block h-full w-full pointer-events-none"
      />
      {/* Subtle purple-indigo dark-glass radial vignette so text remains crisp and readable */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 50% 35%, rgba(6, 9, 24, 0.35) 0%, rgba(6, 9, 24, 0.78) 65%, #060918 100%)',
        }}
      />
      {children && <div className={`relative z-10 ${className}`}>{children}</div>}
    </div>
  );
}
