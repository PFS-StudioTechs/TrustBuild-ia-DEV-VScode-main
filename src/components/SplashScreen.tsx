import { useEffect } from "react";

interface SplashScreenProps {
  onDone: () => void;
}

export default function SplashScreen({ onDone }: SplashScreenProps) {
  useEffect(() => {
    const timer = setTimeout(onDone, 5800);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="splash-screen">
      <div className="splash-corner splash-tl" />
      <div className="splash-corner splash-tr" />
      <div className="splash-corner splash-bl" />
      <div className="splash-corner splash-br" />

      <div className="splash-content">
        <div className="splash-icon">
          <svg className="splash-triangle-svg" viewBox="0 0 100 86" xmlns="http://www.w3.org/2000/svg">
            <path className="splash-triangle-path" d="M50 5 L95 81 L5 81 Z" />
          </svg>
          <div className="splash-lines">
            <div className="splash-line splash-line-1" />
            <div className="splash-line splash-line-2" />
            <div className="splash-line splash-line-3" />
          </div>
        </div>

        <div className="splash-brand">
          <span className="splash-trust">TrustBuild</span>
          <span className="splash-ia">-ia</span>
        </div>

        <div className="splash-tagline">Parce que la confiance se construit</div>

        <div className="splash-dots">
          <div className="splash-dot splash-dot-1" />
          <div className="splash-dot splash-dot-2" />
          <div className="splash-dot splash-dot-3" />
        </div>
      </div>

      <div className="splash-fade-overlay" />
    </div>
  );
}
