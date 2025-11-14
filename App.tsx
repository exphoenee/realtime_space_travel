
import React, { useState, useEffect } from 'react';
import Starfield from './components/Starfield';
import Dashboard from './components/Dashboard';

const App: React.FC = () => {
  const [remainingYears, setRemainingYears] = useState(4878.33);

  useEffect(() => {
    const timer = setInterval(() => {
      setRemainingYears(prevYears => {
        if (prevYears <= 0) {
          clearInterval(timer);
          return 0;
        }
        return prevYears - 0.001;
      });
    }, 50);

    return () => clearInterval(timer);
  }, []);

  return (
    <main className="relative w-screen h-screen bg-black overflow-hidden font-mono">
      <Starfield />
      <div className="absolute inset-0 flex flex-col justify-end items-center pointer-events-none">
        <Dashboard remainingYears={remainingYears} />
      </div>
    </main>
  );
};

export default App;
