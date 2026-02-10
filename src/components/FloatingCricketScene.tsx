import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Sphere, MeshDistortMaterial } from '@react-three/drei';
import { useRef, useMemo } from 'react';
import * as THREE from 'three';

function CricketBall({ position }: { position: [number, number, number] }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.x = state.clock.elapsedTime * 0.5;
    meshRef.current.rotation.z = state.clock.elapsedTime * 0.3;
  });

  return (
    <Float speed={2} rotationIntensity={1} floatIntensity={2}>
      <mesh ref={meshRef} position={position}>
        <sphereGeometry args={[0.4, 32, 32]} />
        <meshStandardMaterial color="#cc2200" roughness={0.3} metalness={0.1} />
        {/* Seam ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.41, 0.02, 8, 32]} />
          <meshStandardMaterial color="#ffffff" roughness={0.5} />
        </mesh>
      </mesh>
    </Float>
  );
}

function GlowOrb({ position, color, size = 0.3 }: { position: [number, number, number]; color: string; size?: number }) {
  return (
    <Float speed={3} rotationIntensity={0.5} floatIntensity={3}>
      <Sphere args={[size, 32, 32]} position={position}>
        <MeshDistortMaterial
          color={color}
          transparent
          opacity={0.4}
          distort={0.4}
          speed={3}
          roughness={0}
        />
      </Sphere>
    </Float>
  );
}

function Particles() {
  const particlesRef = useRef<THREE.Points>(null);
  const count = 100;

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 20;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 20;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 10;
    }
    return pos;
  }, []);

  useFrame((state) => {
    if (!particlesRef.current) return;
    particlesRef.current.rotation.y = state.clock.elapsedTime * 0.02;
    particlesRef.current.rotation.x = state.clock.elapsedTime * 0.01;
  });

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial size={0.05} color="#34d399" transparent opacity={0.6} sizeAttenuation />
    </points>
  );
}

export function FloatingCricketScene({ className = '' }: { className?: string }) {
  return (
    <div className={`absolute inset-0 pointer-events-none ${className}`}>
      <Canvas camera={{ position: [0, 0, 8], fov: 50 }} dpr={[1, 1.5]}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={0.8} />
        <pointLight position={[-10, -10, -10]} color="#34d399" intensity={0.3} />

        <CricketBall position={[3, 2, 0]} />
        <CricketBall position={[-4, -1, -2]} />

        <GlowOrb position={[-2, 3, -1]} color="#34d399" size={0.5} />
        <GlowOrb position={[4, -2, -3]} color="#daa520" size={0.4} />
        <GlowOrb position={[0, -3, -2]} color="#60a5fa" size={0.35} />

        <Particles />
      </Canvas>
    </div>
  );
}
