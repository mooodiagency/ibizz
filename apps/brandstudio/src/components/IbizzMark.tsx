type Props = {
  size?: number
  className?: string
  /** Bij true: AI thinking animatie — slashes pulseren afwisselend */
  animate?: boolean
}

/**
 * Het "//" merkmark van ibizz.
 * Gebruikt currentColor zodat je 'm via text- classes of style kleur kunt geven.
 * Met animate=true → AI thinking effect (afwisselende pulse op beide slashes).
 */
export default function IbizzMark({ size = 18, className, animate = false }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 37.84 25.2"
      width={size}
      height={(size / 37.84) * 25.2}
      fill="currentColor"
      aria-hidden="true"
      className={className}
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
  )
}
