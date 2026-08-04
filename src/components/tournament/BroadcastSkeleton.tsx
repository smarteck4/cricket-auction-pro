const Shimmer = ({ className = '' }: { className?: string }) => (
  <div className={`animate-pulse rounded-md bg-broadcast-fg/10 ${className}`} />
);

function Tile({ className, children }: { className?: string; children?: React.ReactNode }) {
  return <div className={`bc-tile p-5 sm:p-6 ${className ?? ''}`}>{children}</div>;
}

export function TournamentHubSkeleton() {
  return (
    <div className="flex flex-col gap-4 sm:gap-6" aria-busy="true" aria-label="Loading tournament hub">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Shimmer className="h-8 w-44" />
        <Shimmer className="h-10 w-full sm:w-64" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4">
        <Tile className="md:col-span-8 min-h-[200px]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 flex flex-col items-center gap-3">
              <Shimmer className="h-16 w-16 sm:h-20 sm:w-20 rounded-full" />
              <Shimmer className="h-3 w-20" />
            </div>
            <div className="flex flex-col items-center gap-2">
              <Shimmer className="h-3 w-24" />
              <Shimmer className="h-8 w-14" />
              <Shimmer className="h-3 w-20" />
            </div>
            <div className="flex-1 flex flex-col items-center gap-3">
              <Shimmer className="h-16 w-16 sm:h-20 sm:w-20 rounded-full" />
              <Shimmer className="h-3 w-20" />
            </div>
          </div>
        </Tile>

        <Tile className="md:col-span-4 space-y-3">
          <Shimmer className="h-3 w-28" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex justify-between gap-4">
              <Shimmer className="h-3 w-16" />
              <Shimmer className="h-3 w-24" />
            </div>
          ))}
        </Tile>

        <Tile className="md:col-span-4 space-y-3">
          <Shimmer className="h-3 w-24" />
          {[0, 1, 2, 3].map((i) => (
            <Shimmer key={i} className="h-6 w-full" />
          ))}
        </Tile>

        <Tile className="md:col-span-5 space-y-3">
          <Shimmer className="h-3 w-32" />
          {[0, 1, 2].map((i) => (
            <Shimmer key={i} className="h-12 w-full rounded-xl" />
          ))}
        </Tile>

        <Tile className="md:col-span-3 space-y-5">
          <Shimmer className="h-3 w-28" />
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Shimmer className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Shimmer className="h-3 w-24" />
                <Shimmer className="h-3 w-16" />
              </div>
            </div>
          ))}
        </Tile>

        <Tile className="md:col-span-12 grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center justify-center gap-3">
              <Shimmer className="h-4 w-4 rounded-full" />
              <Shimmer className="h-6 w-16" />
            </div>
          ))}
        </Tile>
      </div>
    </div>
  );
}
