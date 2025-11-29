import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { CardData, GamePhase, CardSource } from '../types';

const textureLoader = new THREE.TextureLoader();
const frontTexture = textureLoader.load("https://images.unsplash.com/photo-1755540735826-0ae8cc8b0fe4?q=80&w=2777&auto=format&fit=crop"); 

interface CardDeckProps {
  cards: CardData[];
  phase: GamePhase;
  onCardSelect: (card: CardData) => void;
}

interface CardMeshProps {
  index: number;
  data: CardData;
  phase: GamePhase;
  total: number;
  onSelect: () => void;
}

const CardMesh: React.FC<CardMeshProps> = ({ 
  index, 
  data, 
  phase, 
  onSelect 
}) => {
  const mesh = useRef<THREE.Group>(null);
  const [hovered, setHover] = useState(false);
  const [flipped, setFlipped] = useState(false);
  
  // Calculate target position based on phase
  const getTargetPosition = () => {
    if (phase === GamePhase.SHUFFLING) {
      // Stacked or moving chaotically
      return new THREE.Vector3(0, 0, -index * 0.02);
    } 
    // Grid layout for SELECTION and PREVIEW
    if (phase === GamePhase.SELECTION || phase === GamePhase.PREVIEW) {
      if (flipped && phase === GamePhase.SELECTION) {
        return new THREE.Vector3(0, 0, 2); // Bring to front center when flipped
      }
      // Grid layout
      const cols = 4;
      const row = Math.floor(index / cols);
      const col = index % cols;
      const spacingX = 2.2;
      const spacingY = 3.2;
      return new THREE.Vector3(
        (col - 1.5) * spacingX, 
        (0.5 - row) * spacingY, 
        0
      );
    }
    return new THREE.Vector3(0, 10, 0); // Offscreen top
  };

  const getTargetRotation = () => {
    // If flipped (revealed), show Face (PI)
    if (flipped) return new THREE.Euler(0, Math.PI, 0);
    
    // PREVIEW: Show Face (PI)
    if (phase === GamePhase.PREVIEW) return new THREE.Euler(0, Math.PI, 0);
    
    // SHUFFLING: Show Back (0)
    if (phase === GamePhase.SHUFFLING) return new THREE.Euler(0, 0, 0);
    
    // SELECTION: Show Back (0)
    if (phase === GamePhase.SELECTION) {
        // Slight tilt if hovered, but generally Back (0)
        return new THREE.Euler(
            hovered ? 0.2 : 0, 
            hovered ? 0.1 : 0, 
            0
        );
    }
    
    // Default Back (0)
    return new THREE.Euler(0, 0, 0);
  };

  const handleClick = (e: any) => {
    e.stopPropagation();
    if (phase === GamePhase.SELECTION && !flipped) {
        setFlipped(true);
        // Wait for animation then callback
        setTimeout(() => {
            onSelect();
        }, 1200); // 1.2s flip duration
    }
  };

  useFrame((state, delta) => {
    if (!mesh.current) return;
    
    const targetPos = getTargetPosition();
    const targetRot = getTargetRotation();
    
    // SHUFFLE ANIMATION LOGIC
    if (phase === GamePhase.SHUFFLING) {
      const time = state.clock.getElapsedTime();
      // Orbiting chaos
      const radius = 2;
      targetPos.x += Math.sin(time * 5 + index) * radius;
      targetPos.z += Math.cos(time * 5 + index) * radius;
      targetPos.y += Math.sin(time * 3 + index) * 0.5;
    }

    if (flipped) {
        // Smooth lerp for position
        mesh.current.position.lerp(targetPos, delta * 4);
        
        // Spin effect during flip
        mesh.current.rotation.x = THREE.MathUtils.lerp(mesh.current.rotation.x, targetRot.x, delta * 6);
        mesh.current.rotation.y = THREE.MathUtils.lerp(mesh.current.rotation.y, targetRot.y, delta * 6);
        mesh.current.rotation.z = THREE.MathUtils.lerp(mesh.current.rotation.z, targetRot.z, delta * 6);
    } else {
        // Standard phase movement
        mesh.current.position.lerp(targetPos, delta * 3);
        mesh.current.rotation.x = THREE.MathUtils.lerp(mesh.current.rotation.x, targetRot.x, delta * 5);
        mesh.current.rotation.y = THREE.MathUtils.lerp(mesh.current.rotation.y, targetRot.y, delta * 5);
        mesh.current.rotation.z = THREE.MathUtils.lerp(mesh.current.rotation.z, targetRot.z, delta * 5);
    }
  });

  return (
    <group 
      ref={mesh} 
      onClick={handleClick}
      onPointerOver={() => !flipped && phase === GamePhase.SELECTION && setHover(true)}
      onPointerOut={() => setHover(false)}
    >
      {/* Card Back (Dark Side) - Visible at Rotation 0 */}
      <mesh position={[0, 0, 0.01]}>
        <planeGeometry args={[1.8, 2.8]} />
        <meshStandardMaterial 
            color="#334155" 
            emissive="#0f172a"
            roughness={0.4}
            side={THREE.FrontSide}
        />
        {/* Pattern on back */}
        <mesh position={[0,0,0.01]}>
             <planeGeometry args={[1.6, 2.6]} />
             <meshBasicMaterial color="#1e293b" /> 
             {/* Simple decorative strip */}
             <mesh position={[0,0,0.01]} rotation={[0,0,Math.PI/4]}>
                <planeGeometry args={[1, 1]} />
                <meshBasicMaterial color="#334155" />
             </mesh>
        </mesh>
      </mesh>

      {/* Card Front (Content Side) - Visible at Rotation PI */}
      <mesh rotation={[0, Math.PI, 0]} position={[0, 0, -0.01]}>
        <planeGeometry args={[1.8, 2.8]} />
        <meshBasicMaterial color="#f8fafc" 
              map={frontTexture}
              side={THREE.FrontSide} 
        />
        
        {/* Content Group - Rotated PI so it matches the Mesh orientation? 
            The parent mesh is already rotated PI relative to group.
            Content items are children of this mesh.
            If we want them to face Z when Mesh is facing Z, we just place them at Z > 0 (relative to parent).
        */}
        <group position={[0, 0, 0.01]}>
            {/* Card Content Text */}
             <Text 
                position={[0, 0.2, 0]} 
                fontSize={0.25} 
                color="#0f172a" 
                maxWidth={1.5}
                textAlign="center"
                lineHeight={1.2}
             >
                {data.text}
             </Text>
             
             {/* Source Indicator */}
             <Text 
                position={[0, -0.8, 0]} 
                fontSize={0.1} 
                color={
                    data.source === CardSource.AI ? "#9333ea" : 
                    data.source === CardSource.ORGANIZER ? "#d97706" : "#2563eb"
                }
             >
                {data.source}
             </Text>
             
             {/* Decorative Border/Line */}
             <mesh position={[0, -0.6, 0]}>
                <planeGeometry args={[1.2, 0.02]} />
                <meshBasicMaterial color="#cbd5e1" />
             </mesh>
        </group>
      </mesh>
      
      {/* Border Frame */}
      <mesh>
        <boxGeometry args={[1.82, 2.82, 0.01]} />
        <meshStandardMaterial color={hovered && !flipped && phase === GamePhase.SELECTION ? "#fbbf24" : "#94a3b8"} />
      </mesh>
    </group>
  );
};

export const CardDeck: React.FC<CardDeckProps> = ({ cards, phase, onCardSelect }) => {
  return (
    <group>
      {cards.map((card, idx) => (
        <CardMesh 
          key={card.id} 
          index={idx} 
          data={card} 
          phase={phase} 
          total={cards.length}
          onSelect={() => onCardSelect(card)}
        />
      ))}
    </group>
  );
};