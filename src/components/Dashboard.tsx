import React from "react";

interface DashboardProps {
  remainingYears: number;
  destinationName: string;
  localWeather: string;
}

const Dashboard: React.FC<DashboardProps> = ({
  remainingYears,
  destinationName,
  localWeather,
}) => {
  return (
    <div className="w-full max-w-4xl p-4 md:p-6 mb-4 md:mb-8 bg-black/50 backdrop-blur-sm border-t-2 border-cyan-400/50 rounded-t-lg shadow-lg shadow-cyan-500/10 pointer-events-auto">
      <div className="flex flex-col md:flex-row justify-between items-center text-center md:text-left gap-4">
        <div className="flex-1">
          <h1 className="text-lg md:text-xl font-bold text-cyan-300 tracking-widest uppercase">
            Csillagközi Utazás
          </h1>
          <p className="text-xs md:text-sm text-cyan-500">
            Státusz: Minden rendszer működik
          </p>
        </div>
        <div className="flex-1 text-center border-y-2 md:border-y-0 md:border-x-2 border-cyan-400/30 py-2 md:py-0 md:px-4 space-y-1">
          <p className="text-sm text-cyan-400 uppercase">Cél</p>
          <p className="text-lg font-bold text-white">{destinationName}</p>
          <p className="text-xs text-cyan-300 uppercase tracking-wide">
            Helyi időjárás:
          </p>
          <p className="text-sm font-semibold text-cyan-100">{localWeather}</p>
        </div>
        <div className="flex-1 text-center md:text-right">
          <p className="text-sm text-cyan-400 uppercase tracking-wide">
            Érkezés a célrendszerbe
          </p>
          <p className="text-2xl md:text-4xl font-bold text-yellow-300 animate-pulse">
            {remainingYears.toFixed(7)}{" "}
            <span className="text-xl md:text-2xl text-yellow-400">
              Földi év
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
