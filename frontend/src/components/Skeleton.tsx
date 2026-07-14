import "./Skeleton.css";

interface SkeletonProps {
  width?: string;
  height?: string;
  borderRadius?: string;
  className?: string;
}

export function Skeleton({ width = "100%", height = "1rem", borderRadius = "4px", className = "" }: SkeletonProps) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{ width, height, borderRadius }}
      aria-hidden="true"
    />
  );
}

export function ArticleSkeleton() {
  return (
    <div className="skeleton-card">
      <Skeleton height="1rem" width="60%" />
      <Skeleton height="0.75rem" width="40%" />
      <Skeleton height="3rem" />
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <Skeleton width="4rem" height="1.5rem" borderRadius="999px" />
        <Skeleton width="4rem" height="1.5rem" borderRadius="999px" />
      </div>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="skeleton-card">
      <Skeleton height="1.25rem" width="70%" />
      <Skeleton height="0.875rem" width="50%" />
      <Skeleton height="2.5rem" />
    </div>
  );
}
