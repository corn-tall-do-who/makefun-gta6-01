// PORT VERONA — mission + story definitions (all original).
import { LANDMARKS, DEBT_TOTAL } from './config.js';

export const MISSIONS = [
  {
    id: 1,
    title: 'Back on the Streets',
    brief: "Vic Marino walks out of prison owing $50,000 to fixer Salvatore 'Sal' Kessler. Walk to Sal's office, then steal a car and drive back to him.",
    reward: 1000,
    phases: [
      { text: "Walk to Sal's office (yellow marker)", marker: LANDMARKS.salOffice },
      { text: 'Steal a car — press E near any car', marker: null },
      { text: "Drive back to Sal's office", marker: LANDMARKS.salOffice },
    ],
  },
  {
    id: 2,
    title: 'Harbor Run',
    brief: 'Sal needs a package at the Old Harbor docks — fast. Deliver it before the timer runs out and keep the cops off your tail.',
    reward: 2500,
    timeLimit: 90,
    phases: [
      { text: 'Drive the package to the Old Harbor docks before time runs out', marker: LANDMARKS.docks },
    ],
  },
  {
    id: 3,
    title: 'The Collection',
    brief: "Three debtors owe Sal money. Visit Marco, Lena and Big Tony and collect what's owed. Some of them won't pay quietly.",
    reward: 5000,
    phases: [
      { text: 'Collect from 3 debtors (0/3)', marker: LANDMARKS.debtors[0] },
    ],
  },
  {
    id: 4,
    title: 'Bank Job',
    brief: 'Verona Bank is holding more than it should. Get inside, grab the cash, then lose the cops — the heat will be at 3 stars.',
    reward: 30000,
    phases: [
      { text: 'Enter Verona Bank and grab the cash', marker: LANDMARKS.bank },
      { text: 'Escape! Lose the cops (get wanted to 0)', marker: null },
    ],
  },
  {
    id: 5,
    title: 'Arms Deal',
    brief: 'Meet the supplier at the Industrial Yard. Word is a rival crew plans to crash the deal — be ready for an ambush.',
    reward: 10000,
    phases: [
      { text: 'Meet the supplier at the Industrial Yard', marker: LANDMARKS.supplier },
      { text: 'Survive the ambush — take down the attackers', marker: LANDMARKS.supplier },
    ],
  },
  {
    id: 6,
    title: 'Paying Sal Back',
    brief: `The debt is $50,000. Bring it all to Sal's office and walk away a free man.`,
    reward: 0,
    phases: [
      { text: `Deliver $${DEBT_TOTAL.toLocaleString()} to Sal's office`, marker: LANDMARKS.salOffice },
    ],
  },
];

export function totalEarnedThrough(index) {
  let s = 0;
  for (let i = 0; i < index && i < MISSIONS.length; i++) s += MISSIONS[i].reward;
  return s;
}
