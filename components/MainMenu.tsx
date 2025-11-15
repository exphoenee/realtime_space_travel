import React from "react";
import { Destination } from "../types";

const speedKmPerSecond = 191; // km / s

// HELYES fényév -> km átváltás
const lyToKm = 9_460_730_472_580.8; // ≈ 9.46e12 km, nem 9.46e15!

const secondsPerYear = 365.25 * 24 * 60 * 60;

// hány fényévet tesz meg 1 év alatt
const speedLyPerYear = (speedKmPerSecond * secondsPerYear) / lyToKm;

const baseDestinations = [
  {
    name: "Proxima Centauri Rendszer",
    distanceLy: 4.24,
    wage: 50,
  },
  {
    name: "Wolf 424",
    distanceLy: 14.31,
    wage: 250,
  },
  {
    name: "Ross 780",
    distanceLy: 15.34,
    wage: 1000,
  },
];

// ha akarod, itt már előre ráteheted a travelYears-t is
const destinations = baseDestinations.map((dest) => ({
  ...dest,
  travelYears: dest.distanceLy / speedLyPerYear,
}));

interface MainMenuProps {
  onSelectDestination: (destination: Destination) => void;
}

const MainMenu: React.FC<MainMenuProps> = ({ onSelectDestination }) => {
  return (
    <div className="absolute inset-0 bg-black/50 flex flex-col justify-center items-center z-50 backdrop-blur-sm p-4">
      <div className="text-center">
        <h1 className="text-4xl md:text-6xl font-bold text-cyan-300 tracking-widest uppercase mb-12 animate-pulse">
          Válassz egy küldetést!
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {destinations.map((dest) => (
            <button
              key={dest.name}
              onClick={() =>
                onSelectDestination({
                  name: dest.name,
                  travelYears: dest.travelYears,
                })
              }
              className="group p-6 border-2 border-cyan-400/30 rounded-lg hover:bg-cyan-400/10 hover:border-cyan-400 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-400 transform hover:scale-105"
            >
              <h2 className="text-xl md:text-2xl font-bold text-white tracking-wider">
                {dest.name}
              </h2>
              <p className="text-md md:text-lg text-cyan-400 mt-2">
                {dest.distanceLy} fényév
              </p>
              <h2 className="text-xl md:text-2xl font-bold text-white tracking-wider">
                Jutalom {dest.wage}$
              </h2>
            </button>
          ))}
        </div>

        <h2 className="text-yellow-400 text-lg font-semibold">
          Vedd meg a <span className="font-bold">Tejút DLC</span>-t $19.99-ért
          további csillagrendszerekért!
        </h2>
        <h2 className="text-yellow-400 text-lg font-semibold">
          Hamarosan további DLC-k érkeznek!
        </h2>
      </div>
    </div>
  );
};

export default MainMenu;
