import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface ParticleTextProps {
  text: string;
  previousText?: string;
  color?: string;
  particleCount?: number;
}

export const ParticleText: React.FC<ParticleTextProps> = ({ 
  text, 
  color = "#fbbf24", 
  particleCount = 5000 
}) => {
  const pointsRef = useRef<THREE.Points>(null);

  // Generate target positions based on text using Canvas API
  // This supports any character set (Chinese, Emoji, etc.) that the browser supports
  const targetPositions = useMemo(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const width = 1024; // Lower res for performance, scale up later
    const height = 512;
    
    if (!ctx) return new Float32Array(particleCount * 3);

    canvas.width = width;
    canvas.height = height;

    // Background clear
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    // Text settings
    ctx.fillStyle = '#ffffff';
    // Use a font stack that definitely includes Chinese support
    ctx.font = 'bold 150px "Microsoft JhengHei", "Noto Sans TC", "Cinzel", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, width / 2, height / 2);

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    // Find all valid pixels (white pixels)
    const validPixels: number[] = [];
    for (let i = 0; i < width * height; i++) {
      // Check red channel (since it's white text on black)
      if (data[i * 4] > 128) {
        validPixels.push(i);
      }
    }

    const positions = new Float32Array(particleCount * 3);
    
    if (validPixels.length === 0) return positions;

    for (let i = 0; i < particleCount; i++) {
      // Pick a random valid pixel
      const pixelIndex = validPixels[Math.floor(Math.random() * validPixels.length)];
      const x = (pixelIndex % width);
      const y = Math.floor(pixelIndex / width);

      // Convert to 3D space (centered) and add slight jitter
      // Map x from [0, width] to [-width/2*scale, width/2*scale]
      // Invert Y because canvas Y is down
      const scale = 0.015;
      
      positions[i * 3] = (x - width / 2) * scale;
      positions[i * 3 + 1] = -(y - height / 2) * scale;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 0.25; // Slight Z depth
    }
    
    return positions;
  }, [text, particleCount]);

  // Initial positions (Explosion start)
  const currentPositions = useMemo(() => {
     const arr = new Float32Array(particleCount * 3);
     for(let i=0; i<particleCount; i++) {
         // Start from a cloud around the center
         const theta = Math.random() * Math.PI * 2;
         const phi = Math.acos((Math.random() * 2) - 1);
         const r = 10 + Math.random() * 5;
         
         arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
         arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
         arr[i * 3 + 2] = r * Math.cos(phi);
     }
     return arr;
  }, [particleCount]);

  // Animation Loop
  useFrame((state) => {
    if (!pointsRef.current) return;
    
    const positions = pointsRef.current.geometry.attributes.position.array as Float32Array;
    const time = state.clock.getElapsedTime();

    for (let i = 0; i < particleCount; i++) {
      const ix = i * 3;
      const iy = i * 3 + 1;
      const iz = i * 3 + 2;

      const tx = targetPositions[ix];
      const ty = targetPositions[iy];
      const tz = targetPositions[iz];

      // Lerp towards target
      // Non-linear speed for "magnetic" effect
      const dx = tx - positions[ix];
      const dy = ty - positions[iy];
      const dz = tz - positions[iz];
      
      const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
      
      // Fast start, slow settle
      const speed = Math.min(0.08, 0.03 + dist * 0.05) 
      
      positions[ix] += dx * speed * 0.5;
      positions[iy] += dy * speed * 0.5;
      positions[iz] += dz * speed * 0.5;

      // Add "alive" floating motion
      if (dist < 0.5) {
        positions[ix] += Math.sin(time * 3 + i) * 0.005;
        positions[iy] += Math.cos(time * 2 + i) * 0.005;
      }
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particleCount}
          array={currentPositions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.08}
        color={color}
        transparent
        opacity={0.8}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation={true}
      />
    </points>
  );
};
