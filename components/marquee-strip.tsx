import { cn } from "cn";

export function MarqueeStrip({
  items,
  className,
  ariaLabel,
}: {
  items: string[];
  className?: string;
  ariaLabel?: string;
}) {
  const doubled = [...items, ...items];

  return (
    <div
      className={cn(
        "relative overflow-hidden border-y border-[#2A2A2A] bg-[#0F0F0F] py-4",
        className
      )}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
    >
      <div className="tl-marquee gap-10">
        {doubled.map((item, index) => (
          <span
            key={`${item}-${index}`}
            className="flex shrink-0 items-center gap-3 text-sm font-medium tracking-wide text-muted-foreground"
          >
            <span
              className="size-1.5 rounded-full bg-[#E86A2C]"
              aria-hidden="true"
            />
            {item}
          </span>
        ))}
      </div>
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#0F0F0F] to-transparent"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#0F0F0F] to-transparent"
        aria-hidden="true"
      />
    </div>
  );
}