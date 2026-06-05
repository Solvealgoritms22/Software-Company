"use client";

export function SpeakingIndicator({ active, size = "md" }: { active: boolean; size?: "sm" | "md" }) {
  const dimension = size === "sm" ? "h-6 w-6" : "h-7 w-7";
  return (
    <span className={`relative inline-flex ${dimension} items-center justify-center rounded-full border border-line bg-black/80 text-white shadow-sm ${active ? "ring-2 ring-brand/30" : "opacity-60"}`}>
      {active ? <span className="absolute inset-0 rounded-full border border-brand/40 animate-ping" /> : null}
      <span className="flex items-end gap-[2px]">
        {[0, 1, 2].map((bar) => (
          <span
            key={bar}
            className={`w-[2px] rounded-full bg-white ${active ? "animate-[voice-bar_0.7s_ease-in-out_infinite]" : "h-1"}`}
            style={active ? { height: 5 + bar * 2, animationDelay: `${bar * 120}ms` } : undefined}
          />
        ))}
      </span>
      <style>{`
        @keyframes voice-bar {
          0%, 100% { transform: scaleY(.55); opacity: .65; }
          50% { transform: scaleY(1.35); opacity: 1; }
        }
      `}</style>
    </span>
  );
}
