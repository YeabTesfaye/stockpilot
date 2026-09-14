import { forecastDemand } from '../../server/planning/forecast';

/**
 * Background processor: refresh demand forecast.
 *
 * Called periodically to recompute the 7-day moving average and
 * next-7-day projection for all materials. Results are displayed
 * on the forecast reports page.
 */
export async function processForecastRefresh(materialIds: string[]) {
  const results = await Promise.all(
    materialIds.map(id => forecastDemand(id)),
  );
  return results;
}
