// What each eval score means, the target it should reach, and how to show it.
// The numbers come from backend/evals/metrics.py.
export const METRICS = {
  grader: [
    {
      id: 'point_accuracy',
      label: 'Agreement',
      help: 'How often the grader agrees with you about a key point: covered or not.',
      target: 0.9,
    },
    {
      id: 'precision',
      label: 'No free credit',
      help: 'Of the points it gave credit for, how many you agree were really said. Low = too generous.',
      target: 0.9,
    },
    {
      id: 'recall',
      label: 'No missed credit',
      help: 'Of the points you say were covered, how many it gave credit for. Low = too harsh.',
      target: 0.85,
    },
    {
      id: 'score_gap',
      label: 'Score gap',
      help: 'The average difference between its 0–5 score and the score your labels give.',
      target: 0.5,
      points: true, // shown in points, and lower is better
    },
  ],
  judge: [
    {
      id: 'recall',
      label: 'Caught',
      help: 'Of the planted bad questions, how many it dropped. Low = bad questions get through.',
      target: 0.83,
    },
    {
      id: 'precision',
      label: 'Right drops',
      help: 'Of the questions it dropped, how many were really bad. Low = it throws away good ones.',
      target: 0.83,
    },
    {
      id: 'accuracy',
      label: 'Correct calls',
      help: 'How often its keep-or-drop call was right, over every question.',
      target: 0.9,
    },
  ],
}

// "77%", or "0.4 pts" for the score gap; "–" when there is no number yet.
export function showMetric(metric, value) {
  if (value === null || value === undefined) return '–'
  if (metric.points) return `${value} pts`
  return `${Math.round(value * 100)}%`
}

export function showTarget(metric) {
  if (metric.points) return `target ≤ ${metric.target} pts`
  return `target ≥ ${Math.round(metric.target * 100)}%`
}

// Did it reach the target? (For the score gap, lower is better.)
export function meetsTarget(metric, value) {
  if (value === null || value === undefined) return false
  if (metric.points) return value <= metric.target
  return value >= metric.target
}
