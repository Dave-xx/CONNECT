import { useState } from 'react';
import { Briefcase } from 'lucide-react';

interface Props {
  src?: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
}

export function ImageWithFallback({ src, alt, className = '', fallbackLabel }: Props) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-[#E6F6F3] text-[#132238] border border-[#E6EAF0] ${className}`}
        role="img"
        aria-label={alt}
      >
        <Briefcase className="w-7 h-7 text-[#0D9488] mb-1.5" aria-hidden="true" />
        {fallbackLabel && (
          <span className="text-xs font-medium text-[#667085] px-3 text-center truncate max-w-full">
            {fallbackLabel}
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
