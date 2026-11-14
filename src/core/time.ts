const TZ = "Asia/Jakarta";

export function wibHour(): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: TZ,
    }).format(new Date()),
  );
}

export function greeting(): string {
  const hour = wibHour();

  if (hour >= 4 && hour < 11) return "Selamat pagi";
  if (hour >= 11 && hour < 15) return "Selamat siang";
  if (hour >= 15 && hour < 18) return "Selamat sore";

  return "Selamat malam";
}

export function formatNowWib(): string {
  const formatted = new Intl.DateTimeFormat("id-ID", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: TZ,
  }).format(new Date());

  return `${formatted} WIB`;
}
