import type { AccountType, Position, PositionStatus } from './domain';

const funds = [
  ['PE Premier KKR Americas XII Onshore Fund', 'KKR', 'KKR', 'wine'],
  ['PIMCO Flexible Municipal Income Fund', 'PIMCO', 'P', 'blue'],
  ['Blackstone Capital Partners IX', 'Blackstone', 'BX', 'slate'],
  ['Apollo Strategic Opportunities Fund IV', 'Apollo', 'A', 'green'],
  ['Carlyle Partners VIII', 'Carlyle', 'C', 'blue'],
  ['Brookfield Infrastructure Fund V', 'Brookfield', 'B', 'green'],
  ['HarbourVest Dover Street XI', 'HarbourVest', 'HV', 'wine'],
  ['Lexington Middle Market Investors V', 'Lexington', 'L', 'slate'],
  ['StepStone Secondary Opportunities Fund V', 'StepStone', 'SS', 'blue'],
  ['EQT Infrastructure VI', 'EQT', 'E', 'wine'],
] as const;

const clients = [
  'Dremstedt Chonda',
  'Amelia Harcourt',
  'Benjamin Ortiz',
  'Charlotte Bennett',
  'Daniela Kowalski',
  'Elliot Whitmore',
  'Fatima Al-Mansouri',
  'Gabriel Laurent',
  'Helena Sørensen',
  'Isaac Montgomery',
  'Jun Park',
  'Katarina Novak',
  'Luca Moretti',
  'Maya Rosenberg',
  'Noah Williams',
  'Olivia Thompson',
  'Priya Desai',
  'Quentin Beaumont',
  'Sofia Lindholm',
  'Theo van Dijk',
];

const accountTypes: AccountType[] = ['Individual', 'Joint', 'Entity', 'Trust'];

const targetCounts: Record<Exclude<PositionStatus, 'monitoring'>, number> = {
  ready: 15,
  'in-progress': 3,
  review: 51,
  blocked: 2,
};

function statusForIndex(index: number): PositionStatus {
  if (index === 0 || index === 1) return 'ready';
  if (index === 2) return 'in-progress';
  if (index === 3) return 'review';
  if (index === 4) return 'blocked';

  const remainingReady = targetCounts.ready - 2;
  if (index < 5 + remainingReady) return 'ready';
  const progressEnd = 5 + remainingReady + (targetCounts['in-progress'] - 1);
  if (index < progressEnd) return 'in-progress';
  const reviewEnd = progressEnd + (targetCounts.review - 1);
  if (index < reviewEnd) return 'review';
  if (index < reviewEnd + (targetCounts.blocked - 1)) return 'blocked';
  return 'monitoring';
}

function reasonFor(status: PositionStatus, index: number): string | null {
  if (status === 'review') {
    return [
      'GP consent pending',
      'Client approval required',
      'Eligibility review',
      'NAV evidence stale',
    ][index % 4]!;
  }
  if (status === 'blocked') {
    return index % 2 === 0 ? 'Missing client approval' : 'Transfer restriction';
  }
  if (status === 'in-progress') return 'Documentation in progress';
  if (status === 'monitoring') return index % 7 === 0 ? 'No recent market activity' : null;
  return null;
}

function idPart(value: number): string {
  return value.toString(16).toUpperCase().padStart(4, '0');
}

export function createPositions(count = 413): Position[] {
  return Array.from({ length: count }, (_, index) => {
    const fund = funds[index % funds.length]!;
    const client = clients[(index * 7) % clients.length]!;
    const status = statusForIndex(index);
    const nav = 921_135_000 - index * 1_087_431 + (index % 5) * 4_500_000;
    const hasRange = index !== 0 && index % 6 !== 0;
    const min = 72 + ((index * 3) % 15);
    const accountType = accountTypes[index % accountTypes.length]!;
    return {
      id: `POS-${String(index + 1).padStart(6, '0')}`,
      positionName: fund[0],
      manager: fund[1],
      initials: fund[2],
      brandTone: fund[3],
      client,
      clientId: `6D97${idPart(index + 101)}-F873-4422-${idPart(index + 4096)}`,
      accountType,
      accountId: `${876 + (index % 73)}-${String(19_849 + index * 17).padStart(6, '0')}`,
      nav: Math.max(nav, 2_450_000),
      currency: 'USD',
      valuationDate: ['30 Jun 2026', '31 Mar 2026', '31 Dec 2025'][index % 3]!,
      navSource: ['Fund administrator', 'Manager statement', 'Advisor-uploaded statement'][
        index % 3
      ]!,
      indicativeMin: hasRange ? min : null,
      indicativeMax: hasRange ? Math.min(98, min + 7) : null,
      status,
      reason: reasonFor(status, index),
      stage: status === 'in-progress' ? 'Documentation' : null,
      stageProgress: status === 'in-progress' ? 4 : null,
      updatedMinutes: 15 + (index % 16) * 13,
      owner: ['Arseniy Korobchenko', 'Alexandra Valerik', 'Private Markets Operations'][index % 3]!,
      isNew: index === 0,
      followUp: false,
      documentProgress: status === 'in-progress' ? '4 of 6 received' : 'No active document request',
    };
  });
}

export const positions = createPositions();
