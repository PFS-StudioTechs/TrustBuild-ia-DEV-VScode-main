interface TrustBuildLogoProps {
  size?: number;
  dark?: boolean;
  className?: string;
}

export default function TrustBuildLogo({ size = 64, dark = false, className }: TrustBuildLogoProps) {
  const triangleColor = dark ? '#FFFFFF' : '#2A3040';

  return (
    <svg
      width={size}
      height={Math.round(size * 1.18)}
      viewBox="0 0 100 118"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="TrustBuild-ia"
      role="img"
    >
      <path
        d="M50 5 L95 81 L5 81 Z"
        stroke={triangleColor}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1="18" y1="93" x2="82" y2="93" stroke="#C2410C" strokeWidth="5" strokeLinecap="round" />
      <line x1="28" y1="103" x2="72" y2="103" stroke="#C2410C" strokeWidth="5" strokeLinecap="round" />
      <line x1="37" y1="113" x2="63" y2="113" stroke="#C2410C" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}
