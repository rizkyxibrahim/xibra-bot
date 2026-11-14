export interface ApiEnvelope<T> {
  success: boolean;
  code: string;
  message: string;
  data: T;
  meta: Record<string, unknown> | null;
}

export interface AccountData {
  id: number;
  name: string;
  username: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  email_verified_at: string | null;
  roles?: { name: string; label: string }[];
}

export interface LinkData {
  identity: {
    telegram_user_id: number;
    telegram_username: string | null;
    verified_at: string | null;
  };
  user: { username: string };
}

export interface InvitationData {
  invitation: Record<string, unknown>;
  secrets: {
    code: string;
    token: string;
    link: string | null;
  };
}

export interface SavedLocation {
  latitude: number;
  longitude: number;
  label: string | null;
}

export interface WeatherForecast {
  latitude: number;
  longitude: number;
  timezone: string;
  current: {
    time: string;
    temperature: number | null;
    apparent_temperature: number | null;
    humidity: number | null;
    precipitation: number | null;
    weather_code: number;
    wind_speed: number | null;
  };
  today: {
    date: string | null;
    weather_code: number | null;
    temperature_max: number | null;
    temperature_min: number | null;
    precipitation_probability_max: number | null;
  };
}

export interface NewsCategory {
  key: string;
  label: string;
}

export interface NewsHeadline {
  title: string;
  link: string;
  published_at: string | null;
}
