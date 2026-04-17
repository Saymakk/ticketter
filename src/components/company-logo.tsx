import type { CSSProperties } from "react";

type CompanyLogoSize = "xs" | "sm" | "md" | "lg";

const SIZE_TO_HEIGHT: Record<CompanyLogoSize, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 64,
};

type Props = {
  src: string;
  alt: string;
  size?: CompanyLogoSize;
  className?: string;
  maxAspectRatio?: number;
};

export default function CompanyLogo({
  src,
  alt,
  size = "sm",
  className = "",
  maxAspectRatio = 2.6,
}: Props) {
  const height = SIZE_TO_HEIGHT[size];
  const style: CSSProperties = {
    height,
    width: "auto",
    maxWidth: Math.round(height * maxAspectRatio),
  };

  return (
    // eslint-disable-next-line @next/next/no-img-element -- URL from DB
    <img
      src={src}
      alt={alt}
      style={style}
      className={`block shrink-0 object-contain ${className}`.trim()}
    />
  );
}

