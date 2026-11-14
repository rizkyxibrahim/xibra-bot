import type { WeatherForecast } from "../../api/types.js";

export function weatherDescription(code: number | null): string {
  if (code === null) return "Kondisi tidak diketahui";
  if (code === 0) return "Cerah";
  if ([1, 2].includes(code)) return "Cerah berawan";
  if (code === 3) return "Berawan";
  if ([45, 48].includes(code)) return "Berkabut";
  if ([51, 53, 55, 56, 57].includes(code)) return "Gerimis";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Hujan";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Salju";
  if ([95, 96, 99].includes(code)) return "Badai petir";
  return "Kondisi tidak diketahui";
}

export function weatherEmoji(code: number | null): string {
  if (code === null) return "🌡️";
  if (code === 0) return "☀️";
  if ([1, 2].includes(code)) return "🌤️";
  if (code === 3) return "☁️";
  if ([45, 48].includes(code)) return "🌫️";
  if ([51, 53, 55, 56, 57].includes(code)) return "🌦️";
  if ([95, 96, 99].includes(code)) return "⛈️";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "❄️";
  return "🌧️";
}

/** A missing value is shown as "-" instead of "undefined" or "null". */
function value(input: number | null | undefined, unit: string): string {
  return input === null || input === undefined ? "-" : `${input}${unit}`;
}

export function formatForecast(data: WeatherForecast): string {
  const { current, today } = data;

  return [
    `${weatherEmoji(current.weather_code)} Cuaca Saat Ini`,
    "",
    `🌡️ Suhu: ${value(current.temperature, "°C")}`,
    `🤗 Terasa seperti: ${value(current.apparent_temperature, "°C")}`,
    `💧 Kelembapan: ${value(current.humidity, "%")}`,
    `🌧️ Curah hujan: ${value(current.precipitation, " mm")}`,
    `💨 Angin: ${value(current.wind_speed, " km/jam")}`,
    `Kondisi: ${weatherDescription(current.weather_code)}`,
    "",
    "📅 Prakiraan Hari Ini",
    `${weatherEmoji(today.weather_code)} ${weatherDescription(today.weather_code)}`,
    `🌡️ ${value(today.temperature_min, "°C")} – ${value(today.temperature_max, "°C")}`,
    `🌧️ Peluang hujan: ${value(today.precipitation_probability_max, "%")}`,
    "",
    `🕒 ${current.time} (${data.timezone})`,
  ].join("\n");
}
