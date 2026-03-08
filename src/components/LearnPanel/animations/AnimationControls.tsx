/**
 * @learn-center
 * AnimationControls — pause/play + speed selector rendered below every animation.
 * Must be inside an <AnimationSpeedProvider>.
 */
import { useAnimationSpeed, type AnimationSpeed } from './AnimationSpeedContext';

const SPEEDS: AnimationSpeed[] = [0.5, 1, 2];
const SPEED_LABELS: Record<AnimationSpeed, string> = { 0.5: '0.5×', 1: '1×', 2: '2×' };

export function AnimationControls() {
  const { paused, speed, togglePause, setSpeed } = useAnimationSpeed();

  return (
    <div style={{
      display: 'flex',
      gap: 6,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 10,
      userSelect: 'none',
    }}>
      {/* Pause / Play */}
      <button
        onClick={togglePause}
        title={paused ? 'Resume animation' : 'Pause animation'}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 28,
          borderRadius: 6,
          border: '1px solid',
          borderColor: paused ? 'var(--color-accent, #3b82f6)' : 'rgba(255,255,255,0.18)',
          background: paused ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.05)',
          color: paused ? 'var(--color-accent, #3b82f6)' : 'var(--color-text-primary)',
          cursor: 'pointer',
          fontSize: 11,
          lineHeight: 1,
          transition: 'all 0.15s',
        }}
      >
        {paused ? '▶' : '⏸'}
      </button>

      {/* Divider */}
      <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)' }} />

      {/* Speed buttons */}
      {SPEEDS.map((s) => (
        <button
          key={s}
          onClick={() => setSpeed(s)}
          title={`Set speed to ${SPEED_LABELS[s]}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 28,
            padding: '0 8px',
            borderRadius: 6,
            border: '1px solid',
            borderColor: speed === s ? 'var(--color-accent, #3b82f6)' : 'rgba(255,255,255,0.14)',
            background: speed === s ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.04)',
            color: speed === s ? 'var(--color-accent, #3b82f6)' : 'var(--color-text-primary)',
            opacity: speed === s ? 1 : 0.55,
            cursor: 'pointer',
            fontSize: 11,
            fontFamily: 'monospace',
            fontWeight: speed === s ? 700 : 400,
            transition: 'all 0.15s',
          }}
        >
          {SPEED_LABELS[s]}
        </button>
      ))}
    </div>
  );
}
