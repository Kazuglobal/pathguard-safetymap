"use client"

export function StreetPhotoScene({ ar = false, imageUrl }: { ar?: boolean; imageUrl?: string }) {
  const displayImage = imageUrl && !imageUrl.startsWith("/placeholder")

  return (
    <div className="absolute inset-0 overflow-hidden bg-gradient-to-b from-[#89d0ff] via-[#cceeff] to-[#8dc68d]">
      {displayImage && <img src={imageUrl} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" />}
      {!displayImage && (
        <>
      <div className="absolute left-10 top-8 h-16 w-28 rounded-full bg-white/80 blur-sm" />
      <div className="absolute right-20 top-12 h-12 w-24 rounded-full bg-white/80 blur-sm" />
      <div className="absolute bottom-[43%] left-0 h-28 w-full bg-[#7fc77d]" />
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          className="absolute bottom-[43%] h-28 w-20 rounded-t-[28px] border-2 border-white/40 shadow"
          style={{
            left: `${index * 14 - 4}%`,
            background: index % 2 ? "#d5eefc" : "#f7d9a1",
          }}
        >
          <div className="mx-auto mt-5 grid w-12 grid-cols-2 gap-2">
            {Array.from({ length: 4 }).map((_, child) => (
              <span key={child} className="h-4 rounded-sm bg-white/70" />
            ))}
          </div>
        </div>
      ))}
      <div className="absolute bottom-0 left-1/2 h-[58%] w-[96%] -translate-x-1/2 bg-[#53585f]" style={{ clipPath: "polygon(36% 0,64% 0,100% 100%,0 100%)" }} />
      <div className="absolute bottom-0 left-1/2 h-[58%] w-[14%] -translate-x-1/2 bg-[#f8fafc]/70" style={{ clipPath: "polygon(42% 0,58% 0,78% 100%,22% 100%)" }} />
      {Array.from({ length: 8 }).map((_, index) => (
        <span
          key={index}
          className="absolute left-1/2 h-3 w-20 -translate-x-1/2 rounded-full bg-white"
          style={{ bottom: `${10 + index * 9}%`, width: `${80 - index * 6}px` }}
        />
      ))}
      <div className="absolute left-[23%] top-[30%] h-[38%] w-3 rounded-full bg-[#5b4636]" />
      <div className="absolute left-[21%] top-[27%] h-16 w-16 rounded-full border-4 border-[#ff742f] bg-white/70" />
      <div className="absolute right-[24%] top-[35%] h-[34%] w-3 rounded-full bg-[#4b5563]" />
      <div className="absolute right-[20%] top-[28%] h-14 w-14 rotate-45 rounded-sm border-4 border-[#ffce2e] bg-[#1f2937]" />
        </>
      )}
      {ar && <div className="absolute inset-5 rounded-[28px] border-2 border-white/60 shadow-[inset_0_0_0_9999px_rgba(4,20,40,.08)]" />}
    </div>
  )
}
