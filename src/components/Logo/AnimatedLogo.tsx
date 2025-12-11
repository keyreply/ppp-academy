import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * AnimatedLogo Component - "Neural Murmuration"
 *
 * A 3D perspective animated logo with murmuration flocking behavior.
 * Particles move like a flock of starlings, creating organic swarm patterns.
 * Each particle has a trail that extends when moving and contracts when still.
 *
 * States:
 * - idle: Gentle 3D orbit, particles drift in harmony
 * - thinking: Particles swirl inward, faster murmuration
 * - speaking: Particles pulse outward in waves
 * - listening: Particles contract and glow, absorbing
 * - success: Green burst, particles celebrate
 * - error: Red flash, particles scatter then regroup
 */

export type LogoState = 'idle' | 'thinking' | 'speaking' | 'listening' | 'success' | 'error';

interface AnimatedLogoProps {
  state?: LogoState;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  onClick?: () => void;
  className?: string;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  color: string;
  size: number;
  trail: Array<{ x: number; y: number; z: number }>;
}

// Brand colors
const COLORS = {
  keyBlue: '#37CFFF',
  keyGreen: '#5DE530',
  keyDeepBlue: '#1D57D8',
  keyTeal: '#34DBAE',
  keyNavy: '#111722',
  error: '#FF4757',
};

const PARTICLE_COLORS = [COLORS.keyBlue, COLORS.keyGreen, COLORS.keyTeal, COLORS.keyDeepBlue];

// Size configurations
const SIZES = {
  sm: { container: 32, particleCount: 12, trailLength: 4 },
  md: { container: 48, particleCount: 18, trailLength: 5 },
  lg: { container: 64, particleCount: 24, trailLength: 6 },
  xl: { container: 96, particleCount: 32, trailLength: 8 },
};

// Murmuration flocking parameters
const FLOCKING = {
  separation: 15,      // Minimum distance between particles
  alignment: 0.05,     // How much particles align with neighbors
  cohesion: 0.01,      // How much particles move toward center of neighbors
  maxSpeed: 2,
  maxForce: 0.1,
  neighborRadius: 30,
};

export function AnimatedLogo({
  state = 'idle',
  size = 'md',
  onClick,
  className = ''
}: AnimatedLogoProps) {
  const config = SIZES[size];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>();
  const rotationRef = useRef({ x: 0, y: 0 });
  const targetRotationRef = useRef({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const mouseRef = useRef({ x: 0, y: 0 });

  // Initialize particles
  useEffect(() => {
    const particles: Particle[] = [];
    for (let i = 0; i < config.particleCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 20 + Math.random() * 15;

      particles.push({
        id: i,
        x: radius * Math.sin(phi) * Math.cos(theta),
        y: radius * Math.sin(phi) * Math.sin(theta),
        z: radius * Math.cos(phi),
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        vz: (Math.random() - 0.5) * 0.5,
        color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
        size: 2 + Math.random() * 2,
        trail: [],
      });
    }
    particlesRef.current = particles;
  }, [config.particleCount]);

  // Get state-specific behavior modifiers
  const getStateModifiers = useCallback(() => {
    switch (state) {
      case 'thinking':
        return {
          speedMultiplier: 2.5,
          cohesionMultiplier: 3,
          separationMultiplier: 0.5,
          rotationSpeed: 0.03,
          glowColor: COLORS.keyDeepBlue,
          trailMultiplier: 1.5,
        };
      case 'speaking':
        return {
          speedMultiplier: 1.8,
          cohesionMultiplier: 0.3,
          separationMultiplier: 2,
          rotationSpeed: 0.015,
          glowColor: COLORS.keyBlue,
          trailMultiplier: 1.3,
        };
      case 'listening':
        return {
          speedMultiplier: 0.6,
          cohesionMultiplier: 4,
          separationMultiplier: 0.3,
          rotationSpeed: 0.005,
          glowColor: COLORS.keyTeal,
          trailMultiplier: 0.5,
        };
      case 'success':
        return {
          speedMultiplier: 3,
          cohesionMultiplier: 0.2,
          separationMultiplier: 3,
          rotationSpeed: 0.04,
          glowColor: COLORS.keyGreen,
          trailMultiplier: 2,
        };
      case 'error':
        return {
          speedMultiplier: 4,
          cohesionMultiplier: 0.1,
          separationMultiplier: 4,
          rotationSpeed: 0.05,
          glowColor: COLORS.error,
          trailMultiplier: 2,
        };
      default:
        return {
          speedMultiplier: 1,
          cohesionMultiplier: 1,
          separationMultiplier: 1,
          rotationSpeed: 0.01,
          glowColor: COLORS.keyDeepBlue,
          trailMultiplier: 1,
        };
    }
  }, [state]);

  // Apply murmuration flocking behavior
  const applyFlocking = useCallback((particle: Particle, particles: Particle[], modifiers: ReturnType<typeof getStateModifiers>) => {
    let separationX = 0, separationY = 0, separationZ = 0;
    let alignmentX = 0, alignmentY = 0, alignmentZ = 0;
    let cohesionX = 0, cohesionY = 0, cohesionZ = 0;
    let neighborCount = 0;

    for (const other of particles) {
      if (other.id === particle.id) continue;

      const dx = other.x - particle.x;
      const dy = other.y - particle.y;
      const dz = other.z - particle.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist < FLOCKING.neighborRadius && dist > 0) {
        neighborCount++;

        // Separation - steer away from nearby particles
        if (dist < FLOCKING.separation * modifiers.separationMultiplier) {
          const force = (FLOCKING.separation - dist) / FLOCKING.separation;
          separationX -= (dx / dist) * force;
          separationY -= (dy / dist) * force;
          separationZ -= (dz / dist) * force;
        }

        // Alignment - match velocity of neighbors
        alignmentX += other.vx;
        alignmentY += other.vy;
        alignmentZ += other.vz;

        // Cohesion - move toward center of neighbors
        cohesionX += other.x;
        cohesionY += other.y;
        cohesionZ += other.z;
      }
    }

    if (neighborCount > 0) {
      // Average alignment
      alignmentX = (alignmentX / neighborCount - particle.vx) * FLOCKING.alignment;
      alignmentY = (alignmentY / neighborCount - particle.vy) * FLOCKING.alignment;
      alignmentZ = (alignmentZ / neighborCount - particle.vz) * FLOCKING.alignment;

      // Cohesion toward center of neighbors
      cohesionX = ((cohesionX / neighborCount - particle.x) * FLOCKING.cohesion) * modifiers.cohesionMultiplier;
      cohesionY = ((cohesionY / neighborCount - particle.y) * FLOCKING.cohesion) * modifiers.cohesionMultiplier;
      cohesionZ = ((cohesionZ / neighborCount - particle.z) * FLOCKING.cohesion) * modifiers.cohesionMultiplier;
    }

    // Apply forces
    particle.vx += separationX + alignmentX + cohesionX;
    particle.vy += separationY + alignmentY + cohesionY;
    particle.vz += separationZ + alignmentZ + cohesionZ;

    // Limit speed
    const speed = Math.sqrt(particle.vx ** 2 + particle.vy ** 2 + particle.vz ** 2);
    const maxSpeed = FLOCKING.maxSpeed * modifiers.speedMultiplier;
    if (speed > maxSpeed) {
      particle.vx = (particle.vx / speed) * maxSpeed;
      particle.vy = (particle.vy / speed) * maxSpeed;
      particle.vz = (particle.vz / speed) * maxSpeed;
    }

    // Add attraction to center (keeps particles in view)
    const distFromCenter = Math.sqrt(particle.x ** 2 + particle.y ** 2 + particle.z ** 2);
    if (distFromCenter > 35) {
      const pullStrength = 0.02 * (distFromCenter - 35);
      particle.vx -= (particle.x / distFromCenter) * pullStrength;
      particle.vy -= (particle.y / distFromCenter) * pullStrength;
      particle.vz -= (particle.z / distFromCenter) * pullStrength;
    }

    // Update position
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.z += particle.vz;

    // Update trail based on movement speed
    const currentSpeed = Math.sqrt(particle.vx ** 2 + particle.vy ** 2 + particle.vz ** 2);
    const maxTrailLength = Math.floor(config.trailLength * modifiers.trailMultiplier * Math.min(1, currentSpeed / FLOCKING.maxSpeed));

    particle.trail.unshift({ x: particle.x, y: particle.y, z: particle.z });
    while (particle.trail.length > Math.max(1, maxTrailLength)) {
      particle.trail.pop();
    }
  }, [config.trailLength]);

  // Project 3D to 2D with perspective
  const project = useCallback((x: number, y: number, z: number, rotation: { x: number; y: number }) => {
    // Apply rotation
    const cosX = Math.cos(rotation.x);
    const sinX = Math.sin(rotation.x);
    const cosY = Math.cos(rotation.y);
    const sinY = Math.sin(rotation.y);

    // Rotate around Y axis
    const x1 = x * cosY - z * sinY;
    const z1 = x * sinY + z * cosY;

    // Rotate around X axis
    const y1 = y * cosX - z1 * sinX;
    const z2 = y * sinX + z1 * cosX;

    // Perspective projection
    const perspective = 100;
    const scale = perspective / (perspective + z2 + 50);

    return {
      x: x1 * scale + 50,
      y: y1 * scale + 50,
      scale,
      z: z2,
    };
  }, []);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const modifiers = getStateModifiers();

    const animate = () => {
      ctx.clearRect(0, 0, 100, 100);

      // Smooth rotation interpolation
      if (isHovered) {
        targetRotationRef.current = {
          x: (mouseRef.current.y - 0.5) * 0.5,
          y: (mouseRef.current.x - 0.5) * 0.5,
        };
      } else {
        targetRotationRef.current.y += modifiers.rotationSpeed;
        targetRotationRef.current.x = Math.sin(targetRotationRef.current.y * 0.5) * 0.2;
      }

      rotationRef.current.x += (targetRotationRef.current.x - rotationRef.current.x) * 0.05;
      rotationRef.current.y += (targetRotationRef.current.y - rotationRef.current.y) * 0.05;

      // Apply flocking to all particles
      const particles = particlesRef.current;
      for (const particle of particles) {
        applyFlocking(particle, particles, modifiers);
      }

      // Sort particles by z-depth for proper rendering order
      const sortedParticles = [...particles].sort((a, b) => {
        const projA = project(a.x, a.y, a.z, rotationRef.current);
        const projB = project(b.x, b.y, b.z, rotationRef.current);
        return projA.z - projB.z;
      });

      // Draw ambient glow
      const gradient = ctx.createRadialGradient(50, 50, 0, 50, 50, 45);
      gradient.addColorStop(0, `${modifiers.glowColor}15`);
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 100, 100);

      // Draw particles with trails
      for (const particle of sortedParticles) {
        const proj = project(particle.x, particle.y, particle.z, rotationRef.current);
        const alpha = 0.4 + proj.scale * 0.6;
        const particleSize = particle.size * proj.scale;

        // Draw trail
        if (particle.trail.length > 1) {
          ctx.beginPath();
          const firstPoint = project(particle.trail[0].x, particle.trail[0].y, particle.trail[0].z, rotationRef.current);
          ctx.moveTo(firstPoint.x, firstPoint.y);

          for (let i = 1; i < particle.trail.length; i++) {
            const point = project(particle.trail[i].x, particle.trail[i].y, particle.trail[i].z, rotationRef.current);
            ctx.lineTo(point.x, point.y);
          }

          const trailGradient = ctx.createLinearGradient(
            proj.x, proj.y,
            project(particle.trail[particle.trail.length - 1].x, particle.trail[particle.trail.length - 1].y, particle.trail[particle.trail.length - 1].z, rotationRef.current).x,
            project(particle.trail[particle.trail.length - 1].x, particle.trail[particle.trail.length - 1].y, particle.trail[particle.trail.length - 1].z, rotationRef.current).y
          );
          trailGradient.addColorStop(0, `${particle.color}${Math.floor(alpha * 180).toString(16).padStart(2, '0')}`);
          trailGradient.addColorStop(1, `${particle.color}00`);

          ctx.strokeStyle = trailGradient;
          ctx.lineWidth = particleSize * 0.8;
          ctx.lineCap = 'round';
          ctx.stroke();
        }

        // Draw particle glow
        const glowGradient = ctx.createRadialGradient(proj.x, proj.y, 0, proj.x, proj.y, particleSize * 3);
        glowGradient.addColorStop(0, `${particle.color}${Math.floor(alpha * 100).toString(16).padStart(2, '0')}`);
        glowGradient.addColorStop(1, `${particle.color}00`);
        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, particleSize * 3, 0, Math.PI * 2);
        ctx.fill();

        // Draw particle core
        ctx.fillStyle = `${particle.color}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`;
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, particleSize, 0, Math.PI * 2);
        ctx.fill();

        // Draw highlight
        ctx.fillStyle = `#ffffff${Math.floor(alpha * 150).toString(16).padStart(2, '0')}`;
        ctx.beginPath();
        ctx.arc(proj.x - particleSize * 0.3, proj.y - particleSize * 0.3, particleSize * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw subtle center core
      const coreGradient = ctx.createRadialGradient(50, 50, 0, 50, 50, 8);
      coreGradient.addColorStop(0, `${COLORS.keyDeepBlue}40`);
      coreGradient.addColorStop(0.5, `${COLORS.keyBlue}20`);
      coreGradient.addColorStop(1, 'transparent');
      ctx.fillStyle = coreGradient;
      ctx.beginPath();
      ctx.arc(50, 50, 8, 0, Math.PI * 2);
      ctx.fill();

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [state, isHovered, getStateModifiers, applyFlocking, project]);

  // Handle mouse movement for interactive rotation
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseRef.current = {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  }, []);

  return (
    <div
      className={`relative cursor-pointer transition-transform duration-300 ${isHovered ? 'scale-110' : 'scale-100'} ${className}`}
      style={{ width: config.container, height: config.container }}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseMove={handleMouseMove}
      role="img"
      aria-label={`KeyReply Kira logo - ${state} state`}
    >
      <canvas
        ref={canvasRef}
        width={100}
        height={100}
        className="w-full h-full"
        style={{
          filter: `drop-shadow(0 0 ${isHovered ? 15 : 8}px ${getStateModifiers().glowColor}50)`,
        }}
      />
    </div>
  );
}

export default AnimatedLogo;
