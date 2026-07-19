import { useId } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

export type AiyaMood = 'happy' | 'excited' | 'wave' | 'think' | 'point'

interface AiyaCharacterProps {
  /** Rendered width/height in px. Below 48px fine details (sparkles, arms) are dropped. */
  size?: number
  mood?: AiyaMood
  /** Enables blink/float/wave loops. Keep false in long lists (chat bubbles). */
  animated?: boolean
  /** Gaze direction, each component in [-1, 1]. e.g. {x:0, y:-1} looks up.
   *  Lets Aiya glance toward whatever she's pointing at. */
  look?: { x: number; y: number }
  className?: string
}

// Four-point sparkle used around Aiya's head at detail sizes.
const SPARKLE_PATH = 'M0 -6 L1.6 -1.6 L6 0 L1.6 1.6 L0 6 L-1.6 1.6 L-6 0 L-1.6 -1.6 Z'

const clampUnit = (v: number | undefined) => (v == null ? 0 : Math.max(-1, Math.min(1, v)))

/**
 * Aiya's mascot: a warm flame/droplet spirit drawn in the app's primary
 * palette. Pure SVG (no assets), theme-agnostic, scales from 28px chat
 * avatars up to full-screen onboarding hero.
 */
export default function AiyaCharacter({
  size = 64,
  mood = 'happy',
  animated = true,
  look,
  className,
}: AiyaCharacterProps) {
  const prefersReducedMotion = useReducedMotion()
  // useId can contain ':' which breaks url(#...) references — strip it.
  const uid = useId().replace(/[^a-zA-Z0-9-]/g, '')
  const gradId = `aiya-body-${uid}`
  const mouthClipId = `aiya-mouth-${uid}`

  const anim = animated && !prefersReducedMotion
  const detail = size >= 48
  const float = anim && size >= 60

  const eyesClosed = mood === 'excited'
  const thinking = mood === 'think'
  const pupilDx = thinking ? 2 : 1
  const pupilCy = thinking ? 68.5 : 71
  // Gaze offset — pupils shift toward `look`, bounded so they stay inside the
  // eye whites (rx 8.5 / ry 9.5, pupil r 4.2 → ~2.6 / ~2.2 px of travel).
  const lookX = clampUnit(look?.x) * 2.6
  const lookY = clampUnit(look?.y) * 2.2

  return (
    <motion.div
      className={className}
      style={{ width: size, height: size, display: 'inline-block' }}
      animate={float ? { y: [0, -size * 0.045, 0] } : undefined}
      transition={float ? { duration: 3.2, repeat: Infinity, ease: 'easeInOut' } : undefined}
    >
      <svg
        viewBox="0 0 120 116"
        width={size}
        height={size}
        role="img"
        aria-hidden="true"
        style={{ display: 'block', overflow: 'visible' }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0.55" y2="1">
            <stop offset="0%" stopColor="#FFB27A" />
            <stop offset="55%" stopColor="#FF6B35" />
            <stop offset="100%" stopColor="#E8541F" />
          </linearGradient>
          <clipPath id={mouthClipId}>
            <path d="M48 82 Q60 98 72 82 Z" />
          </clipPath>
        </defs>

        {/* Sparkles around the head (detail sizes only).
            Positioning lives on a static outer <g>: framer-motion emits animated
            SVG transforms as CSS style.transform, which would override a static
            transform attribute on the SAME element (sparkles would collapse to
            the 0,0 origin while animating). */}
        {detail && (
          <>
            <g transform="translate(18 32)">
              <motion.path
                d={SPARKLE_PATH}
                fill="#FFD166"
                animate={anim ? { opacity: [0.25, 1, 0.25], scale: [0.75, 1.1, 0.75] } : undefined}
                transition={anim ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } : undefined}
                style={{ transformBox: 'fill-box' }}
                opacity={anim ? undefined : 0.85}
              />
            </g>
            <g transform="translate(102 26) scale(0.75)">
              <motion.path
                d={SPARKLE_PATH}
                fill="#FFE8A3"
                animate={anim ? { opacity: [1, 0.25, 1], scale: [1.05, 0.7, 1.05] } : undefined}
                transition={anim ? { duration: 2.9, repeat: Infinity, ease: 'easeInOut', delay: 0.6 } : undefined}
                style={{ transformBox: 'fill-box' }}
                opacity={anim ? undefined : 0.7}
              />
            </g>
          </>
        )}

        {/* Arms (detail sizes only) */}
        {detail && (
          <>
            {/* Left stub arm */}
            <ellipse cx="24" cy="82" rx="3.6" ry="8.5" fill="#E8541F" transform="rotate(28 24 82)" />
            {mood === 'wave' ? (
              // Raised, waving right arm. Static <g> carries the position;
              // pivot uses framer's originX/originY (a plain CSS transformOrigin
              // string would be overwritten by framer's SVG transform handling).
              <g transform="translate(93 64)">
                <motion.g
                  animate={anim ? { rotate: [-20, 16, -20] } : undefined}
                  transition={anim ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut' } : undefined}
                  style={{ transformBox: 'fill-box', originX: 0.2, originY: 0.9 }}
                >
                  <ellipse cx="4" cy="-8" rx="3.8" ry="9.5" fill="#E8541F" transform="rotate(-35 4 -8)" />
                </motion.g>
              </g>
            ) : mood === 'point' ? (
              // Arm extended down-and-out with a rounded "hand" — a friendly
              // "look over here" gesture. Bobs around the SHOULDER (top-left of
              // the group bbox) so the pointing hand sweeps and draws the eye.
              <motion.g
                animate={anim ? { rotate: [0, 7, 0] } : undefined}
                transition={anim ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } : undefined}
                style={{ transformBox: 'fill-box', originX: 0.08, originY: 0.08 }}
              >
                <ellipse cx="99" cy="90" rx="3.6" ry="9.5" fill="#E8541F" transform="rotate(-46 99 90)" />
                <circle cx="107" cy="98" r="3.6" fill="#E8541F" />
              </motion.g>
            ) : (
              <ellipse cx="96" cy="82" rx="3.6" ry="8.5" fill="#E8541F" transform="rotate(-28 96 82)" />
            )}
          </>
        )}

        {/* Body — rounded flame/droplet */}
        <path
          d="M60 10 C60 10 97 44 97 74 C97 96 80 110 60 110 C40 110 23 96 23 74 C23 44 60 10 60 10 Z"
          fill={`url(#${gradId})`}
        />
        {/* Soft highlight */}
        <ellipse cx="45" cy="42" rx="9" ry="15" fill="#FFFFFF" opacity="0.22" transform="rotate(-18 45 42)" />

        {/* Cheeks */}
        <ellipse cx="36" cy="79" rx="5.5" ry="3.5" fill="#FFB4A2" opacity="0.85" />
        <ellipse cx="84" cy="79" rx="5.5" ry="3.5" fill="#FFB4A2" opacity="0.85" />

        {/* Eyes */}
        {eyesClosed ? (
          // Happy closed eyes: ^ ^
          <>
            <path d="M38 71 Q45 63 52 71" stroke="#4A1D0F" strokeWidth="3.5" strokeLinecap="round" fill="none" />
            <path d="M68 71 Q75 63 82 71" stroke="#4A1D0F" strokeWidth="3.5" strokeLinecap="round" fill="none" />
          </>
        ) : (
          <motion.g
            animate={anim ? { scaleY: [1, 1, 0.08, 1, 1] } : undefined}
            transition={
              anim
                ? { duration: 4.4, repeat: Infinity, ease: 'easeInOut', times: [0, 0.9, 0.94, 0.98, 1] }
                : undefined
            }
            style={{ transformBox: 'fill-box', originY: 0.6 }}
          >
            <ellipse cx="45" cy="70" rx="8.5" ry="9.5" fill="#FFFFFF" />
            <ellipse cx="75" cy="70" rx="8.5" ry="9.5" fill="#FFFFFF" />
            <circle cx={45 + pupilDx + lookX} cy={pupilCy + lookY} r="4.2" fill="#4A1D0F" />
            <circle cx={75 + pupilDx + lookX} cy={pupilCy + lookY} r="4.2" fill="#4A1D0F" />
            <circle cx={47.5 + lookX} cy={67 + lookY} r="1.6" fill="#FFFFFF" />
            <circle cx={77.5 + lookX} cy={67 + lookY} r="1.6" fill="#FFFFFF" />
          </motion.g>
        )}

        {/* Thinking brow */}
        {thinking && (
          <path d="M38 56 Q45 52 52 55" stroke="#4A1D0F" strokeWidth="3" strokeLinecap="round" fill="none" />
        )}

        {/* Mouth */}
        {mood === 'excited' || mood === 'wave' ? (
          <>
            <path d="M48 82 Q60 98 72 82 Z" fill="#7C2D12" />
            <ellipse cx="60" cy="93" rx="7" ry="5" fill="#FF8FA3" clipPath={`url(#${mouthClipId})`} />
          </>
        ) : thinking ? (
          <circle cx="60" cy="86" r="3" fill="#7C2D12" />
        ) : (
          <path d="M50 84 Q60 92 70 84" stroke="#4A1D0F" strokeWidth="3.5" strokeLinecap="round" fill="none" />
        )}
      </svg>
    </motion.div>
  )
}
