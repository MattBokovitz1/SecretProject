import NFLDefenseChart from "./components/NFLDefenseChart";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#07080d] relative">
      {/* Ambient glow orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-blue-600/[0.07] blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-cyan-500/[0.05] blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-blue-500/[0.03] blur-[150px]" />
      </div>
      <div className="relative z-10 py-10">
        <NFLDefenseChart />
      </div>
    </div>
  );
}
