import { DotWave as LdrsDotWave } from 'ldrs/react';
import 'ldrs/react/DotWave.css';

interface DotWaveProps {
  size?: number;
  speed?: number;
  color?: string;
}

export function DotWave({
  size = 24,
  speed = 1,
  color = 'currentColor'
}: DotWaveProps) {
  return <LdrsDotWave size={size} speed={speed} color={color} />;
}
