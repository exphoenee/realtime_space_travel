import { useState, useEffect } from "react";
import {
  MAX_WEATHER_UPDATE_INTERVAL_MS,
  MIN_WEATHER_UPDATE_INTERVAL_MS,
} from "../constants/constants";
import { weatherConditions } from "../constants/universeData";
import type { WeatherCondition } from "../constants/universeData";
import { Destination } from "../types";

export const useWeather = (destination: Destination | null): WeatherCondition => {
  const [localWeather, setLocalWeather] = useState(weatherConditions[0]);

  useEffect(() => {
    const pickWeather = () =>
      weatherConditions[Math.floor(Math.random() * weatherConditions.length)];

    if (!destination) {
      setLocalWeather(weatherConditions[0]);
      return;
    }

    let timeoutId: number | null = null;

    const scheduleNext = () => {
      const delay =
        MIN_WEATHER_UPDATE_INTERVAL_MS +
        Math.random() *
          (MAX_WEATHER_UPDATE_INTERVAL_MS - MIN_WEATHER_UPDATE_INTERVAL_MS);
      timeoutId = window.setTimeout(() => {
        setLocalWeather(pickWeather());
        scheduleNext();
      }, delay);
    };

    setLocalWeather(pickWeather());
    scheduleNext();

    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [destination]);

  return localWeather;
};
