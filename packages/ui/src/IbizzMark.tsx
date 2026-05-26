'use client'

export type IbizzMarkProps = {
  size?: number
  className?: string
  /** Bij true: AI thinking animatie — slashes pulseren afwisselend. */
  animate?: boolean
}

/**
 * Het "//" merkmark van ibizz — gedeeld over alle apps.
 * Gebruikt currentColor zodat je 'm via text- classes of style kleur kunt geven.
 * Met animate=true → AI thinking/loading effect (afwisselende pulse op beide slashes).
 *
 * De keyframe animatie is SELF-CONTAINED (inline <style>) zodat dit component
 * in elke app werkt zonder dat de globals.css aangepast hoeft te worden.
 */
export function IbizzMark({ size = 18, className, animate = false }: IbizzMarkProps) {
  return (
    <span className={className} style={{ display: 'inline-flex', lineHeight: 0 }}>
      {animate && (
        <style>{`
          @keyframes ibizz-slash-pulse-a {
            0%, 100% { opacity: 1; transform: translateX(0); }
            50% { opacity: 0.25; transform: translateX(-1px); }
          }
          @keyframes ibizz-slash-pulse-b {
            0%, 100% { opacity: 0.25; transform: translateX(1px); }
            50% { opacity: 1; transform: translateX(0); }
          }
          .ibizz-slash-1 {
            animation: ibizz-slash-pulse-a 1.4s ease-in-out infinite;
            transform-origin: center;
            transform-box: fill-box;
          }
          .ibizz-slash-2 {
            animation: ibizz-slash-pulse-b 1.4s ease-in-out infinite;
            transform-origin: center;
            transform-box: fill-box;
          }
        `}</style>
      )}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 37.84 25.2"
        width={size}
        height={(size / 37.84) * 25.2}
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          d="M16.9.1L0 25.2h8.8L25.7.1h-8.8z"
          className={animate ? 'ibizz-slash-1' : undefined}
        />
        <path
          d="M35.7 0h-4.9L13.9 25.2h8.9L37.5 3.3c.6-1 .4-2.2-.6-2.9-.4-.2-.8-.3-1.2-.4"
          className={animate ? 'ibizz-slash-2' : undefined}
        />
      </svg>
    </span>
  )
}

export default IbizzMark
