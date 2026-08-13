export type PresentedCloudCover = "clear" | "partly cloudy" | "mostly cloudy" | "overcast";

/**
 * The simulation and portable-save schema retain the meteorological oktas
 * category `broken`. Player-facing prose uses the more natural `mostly cloudy`
 * so an intact weather state never reads like an application failure.
 */
export function cloudCoverAdjective(value: string): PresentedCloudCover {
  if (value === "broken") return "mostly cloudy";
  if (value === "scattered") return "partly cloudy";
  if (value === "overcast") return "overcast";
  return "clear";
}

export function cloudCoverLabel(value: string) {
  const adjective = cloudCoverAdjective(value);
  return adjective === "clear" ? "clear" : adjective;
}

export function cloudCoverPhrase(value: string) {
  const adjective = cloudCoverAdjective(value);
  return adjective === "clear" ? "clear skies" : `${adjective} skies`;
}
