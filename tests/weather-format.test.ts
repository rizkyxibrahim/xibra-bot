import { describe, expect, it } from "vitest";
import type { WeatherForecast } from "../src/api/types.js";
import { formatForecast } from "../src/modules/weather/format.js";

function forecast(
  overrides: Partial<WeatherForecast["current"]> = {},
): WeatherForecast {
  return {
    latitude: -6.23,
    longitude: 106.99,
    timezone: "Asia/Jakarta",
    current: {
      time: "2026-11-14T12:15:00+07:00",
      temperature: 31.4,
      apparent_temperature: 36,
      humidity: 70,
      precipitation: 0.2,
      weather_code: 3,
      wind_speed: 9.5,
      ...overrides,
    },
    today: {
      date: "2026-11-14",
      weather_code: 95,
      temperature_max: 33.1,
      temperature_min: 25.2,
      precipitation_probability_max: 80,
    },
  };
}

describe("formatForecast", () => {
  it("shows the humidity sent by the API", () => {
    const text = formatForecast(forecast());

    expect(text).toContain("Kelembapan: 70%");
    expect(text).toContain("Suhu: 31.4°C");
    expect(text).toContain("Badai petir");
    expect(text).toContain("Peluang hujan: 80%");
  });

  it("never prints undefined or null", () => {
    const text = formatForecast(
      forecast({ humidity: null, temperature: null, wind_speed: null }),
    );

    expect(text).toContain("Kelembapan: -");
    expect(text).not.toContain("undefined");
    expect(text).not.toContain("null");
  });
});
