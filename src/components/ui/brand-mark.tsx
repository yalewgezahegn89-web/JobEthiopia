export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect width="32" height="32" rx="8" fill="#0D7377" />
      <path
        d="M16 6 L20 12 L16 20 L12 12 Z"
        fill="#FFFFFF"
        opacity="0.95"
      />
      <path
        d="M16 14 L18.5 11.5 L16 26 L13.5 11.5 Z"
        fill="#E8A838"
      />
      <circle cx="16" cy="9" r="2" fill="#FFFFFF" />
    </svg>
  );
}
