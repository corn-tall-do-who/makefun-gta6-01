// PORT VERONA — config & constants (written from scratch for make.fun gta6-01)
export const WORLD_W = 3200;
export const WORLD_H = 2400;
export const ROAD_W = 96;

// Grid roads (city is a regular street grid)
export const ROADS_X = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];
export const ROADS_Y = [200, 600, 1000, 1400, 1800, 2200];

// Beach / sea bands at the south edge of the map
export const SAND_Y = 2200;
export const SEA_Y = 2320;

export const PALETTE = {
  ground: '#cdb98f',
  harbor: '#b8b3a4',
  downtown: '#c4c0b2',
  littleVerona: '#d3c49a',
  industrial: '#b3aa9c',
  beach: '#e8d5a0',
  sea: '#2e7fa8',
  seaDeep: '#1f6390',
  road: '#3c3c44',
  roadEdge: '#2c2c33',
  sidewalk: '#b9b3a4',
  lane: '#e8c84a',
};

export const DISTRICT_COLORS = {
  harbor: ['#7d8a99', '#6d7c8c', '#8d97a3', '#5f7484'],
  downtown: ['#a89a7e', '#8f8578', '#b3a586', '#7e7468', '#9c8f7a'],
  littleVerona: ['#c98f6a', '#b97f5e', '#d9a077', '#a9714f', '#c2845f'],
  industrial: ['#7a7a72', '#8a8578', '#6b6f6a', '#94907f'],
  beach: ['#d9b380', '#cfa878', '#e0c08e'],
};

// Landmarks (all original names)
export const LANDMARKS = {
  salOffice: { x: 1400, y: 560, label: "Sal's Office" },
  docks: { x: 160, y: 1000, label: 'Old Harbor Docks' },
  bank: { x: 1800, y: 960, label: 'Verona Bank' },
  supplier: { x: 2920, y: 1400, label: 'Industrial Yard' },
  hospital: { x: 1000, y: 1760, label: 'Verona General Hospital' },
  debtors: [
    { x: 600, y: 1360, label: 'Debtor: Marco' },
    { x: 2200, y: 560, label: 'Debtor: Lena' },
    { x: 2600, y: 1760, label: 'Debtor: Big Tony' },
  ],
};

export const PLAYER_START = { x: 1400, y: 720 };
export const SAVE_KEY = 'port-verona-save-v1';
export const DEBT_TOTAL = 50000;
export const START_MONEY = 1500;
