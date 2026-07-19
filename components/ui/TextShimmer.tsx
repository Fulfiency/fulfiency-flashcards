export default function TextShimmer({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`text-shimmer ${className}`}>{children}</span>
  );
}
