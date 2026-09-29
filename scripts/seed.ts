import { addDays, dayInZone } from '@rehab/core';
import { randomUUID } from 'node:crypto';
const url = process.env.API_URL ?? 'http://localhost:3000';
const token = process.env.API_TOKEN;
if (!token) throw new Error('Set API_TOKEN to an account token');
async function post(path: string, body: unknown) {
  const r = await fetch(`${url}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
  return r.json() as Promise<any>;
}
const existing = (await fetch(`${url}/programmes`, {
  headers: { Authorization: `Bearer ${token}` },
}).then((r) => r.json())) as any[];
if (existing.some((p) => p.name === 'Neck rehabilitation')) {
  console.log('Trial programme already exists; no changes made.');
  process.exit(0);
}
const definitions = [
  {
    name: 'Cervical rotation',
    description: 'Gentle neck mobility',
    category: 'Mobility',
    instructions: [
      'Sit tall with your shoulders relaxed.',
      'Slowly turn your head to one side within your comfortable range.',
      'Return to the centre, then repeat on the other side.',
    ],
  },
  {
    name: 'Chin tuck',
    description: 'A small, controlled movement',
    category: 'Mobility',
    instructions: [
      'Sit or stand with your eyes level.',
      'Draw your chin straight back gently, as prescribed.',
      'Release slowly and repeat.',
    ],
  },
  {
    name: 'Thoracic extension',
    description: 'Upper back mobility',
    category: 'Mobility',
    equipment: 'Chair',
    instructions: [
      'Sit on a stable chair with your feet on the floor.',
      'Support your head and gently extend your upper back over the chair.',
      'Return to your starting position.',
    ],
  },
  {
    name: 'Deep neck flexor hold',
    description: 'A gentle isometric hold',
    category: 'Strength',
    equipment: 'Mat',
    instructions: [
      'Lie on your back in a comfortable position.',
      'Make a small chin nod, following the technique your clinician showed you.',
      'Hold for the prescribed duration, then relax.',
    ],
  },
  {
    name: 'Cervical isometric extension',
    description: 'Steady, controlled resistance',
    category: 'Strength',
    instructions: [
      'Sit tall and place your hand behind your head.',
      'Gently press your head into your hand without moving your neck.',
      'Hold, then release.',
    ],
  },
  {
    name: 'Cervical isometric rotation',
    description: 'A gentle rotation hold',
    category: 'Strength',
    instructions: [
      'Place a hand against the side of your head.',
      'Gently press into your hand as if turning your head, without moving.',
      'Hold, release and repeat on the other side.',
    ],
  },
];
const exercises = [];
for (const d of definitions) exercises.push(await post('/exercises', d));
const mobility = [
  { exerciseId: exercises[0].id, reps: 8, side: 'both' },
  { exerciseId: exercises[1].id, sets: 2, reps: 10 },
  { exerciseId: exercises[2].id, reps: 10 },
];
const strength = [
  { exerciseId: exercises[3].id, sets: 3, holdSeconds: 20, restSeconds: 30 },
  { exerciseId: exercises[4].id, sets: 3, holdSeconds: 15, restSeconds: 30 },
  { exerciseId: exercises[5].id, sets: 3, holdSeconds: 15, side: 'both', restSeconds: 30 },
];
const p = await post('/programmes', {
  name: 'Neck rehabilitation',
  description: 'Sample programme for trying the app. Replace it with your prescribed plan.',
  startDate: dayInZone('Europe/London'),
  durationWeeks: 6,
  timezone: 'Europe/London',
  phases: [
    { id: randomUUID(), name: 'Settle & mobilise', startWeek: 1, endWeek: 2 },
    { id: randomUUID(), name: 'Build strength', startWeek: 3, endWeek: 4 },
    { id: randomUUID(), name: 'Move with confidence', startWeek: 5, endWeek: 6 },
  ],
  sessions: [
    ...['08:00', '13:00', '17:30'].map((time, i) => ({
      name: ['Morning mobility', 'Midday reset', 'Evening mobility'][i],
      time,
      weekdays: [1, 2, 3, 4, 5, 6, 7],
      estimatedMinutes: 5,
      prescriptions: mobility,
    })),
    {
      name: 'Neck strength',
      time: '20:30',
      weekdays: [1, 2, 3, 4, 5, 6, 7],
      estimatedMinutes: 15,
      prescriptions: strength,
    },
  ],
});
await post('/assessments', {
  name: 'Daily check-in',
  programmeId: p.id,
  trigger: 'daily',
  time: '09:00',
  fields: [
    { id: 'pain', label: 'Pain', type: 'numericScale', min: 0, max: 10, required: true },
    { id: 'stiffness', label: 'Stiffness', type: 'numericScale', min: 0, max: 10, required: true },
    {
      id: 'arm_symptoms',
      label: 'Arm symptoms',
      type: 'singleChoice',
      options: ['None', 'Mild', 'Moderate', 'Severe'],
    },
    { id: 'notes', label: 'Anything you’d like to note?', type: 'text' },
  ],
});
console.log(
  `Created ${p.name} (${p.id}) and four daily sessions through the API. No fabricated completion or symptom history.`,
);
