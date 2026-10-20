import { type LevelIndex } from '../logic/graph';
import { forecastOf } from '../logic/text';

/** What will happen in the stress test, before the player plans: every situation and its events. */
export function Forecast({ index }: { index: LevelIndex }) {
  const forecast = forecastOf(index);
  return (
    <section className="bb-forecast" aria-labelledby="bb-forecast-title">
      <h3 id="bb-forecast-title">What will happen</h3>
      <ul>
        {forecast.map((situation) => (
          <li key={situation.id}>
            <strong>{situation.name}</strong>
            {situation.items.length === 0 ? (
              <span className="bb-forecast-quiet">Nothing special.</span>
            ) : (
              <ul>
                {situation.items.map((item) => (
                  <li key={`${item.minutes}-${item.text}`} data-kind={item.kind}>
                    <span className="bb-forecast-when">{item.minutes}</span> {item.text}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
