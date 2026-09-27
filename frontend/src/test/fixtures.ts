import type { Dashboard, EngineerOverview } from '../api/types'

export const dashboard: Dashboard = {
  today: '2026-09-27',
  summary: { clusters: 3, projects: 3, engineers: 4, unallocated_engineers: 1 },
  clusters: [
    {
      id: 1,
      name: 'Payments',
      qa_manager: { id: 7, full_name: 'Olena Kovalenko' },
      projects: [
        {
          id: 10,
          name: 'Payment Gateway',
          description: 'Core card payment processing',
          cluster_id: 1,
          allocations: [
            {
              id: 100,
              engineer: { id: 1, full_name: 'Anna Melnyk' },
              role: 'QC',
              percent: 100,
              comment: 'Backend and API testing.',
              start_date: '2026-09-01',
              end_date: null,
              status: 'active',
            },
            {
              id: 101,
              engineer: { id: 2, full_name: 'Maksym Bondar' },
              role: 'QC Lead',
              percent: 50,
              comment: '',
              start_date: '2026-08-15',
              end_date: null,
              status: 'active',
            },
          ],
        },
      ],
    },
    {
      id: 2,
      name: 'Core Platform',
      qa_manager: null,
      projects: [
        {
          id: 20,
          name: 'Notification Service',
          description: 'Email, SMS and push delivery',
          cluster_id: 2,
          allocations: [],
        },
        {
          id: 21,
          name: 'Data Platform',
          description: '',
          cluster_id: 2,
          allocations: [
            {
              id: 102,
              engineer: { id: 5, full_name: 'Kateryna Romanenko' },
              role: 'QC',
              percent: 50,
              comment: 'Planned allocation.',
              start_date: '2026-10-01',
              end_date: '2026-12-31',
              status: 'planned',
            },
          ],
        },
      ],
    },
    { id: 3, name: 'New Initiatives', qa_manager: null, projects: [] },
  ],
}

const engineer = (
  id: number,
  full_name: string,
  overrides: Partial<EngineerOverview> = {},
): EngineerOverview => ({
  id,
  full_name,
  comment: '',
  allocations: [],
  managed_clusters: [],
  total_percent: 0,
  status: 'unallocated',
  ...overrides,
})

export const engineersOverview: EngineerOverview[] = [
  engineer(1, 'Anna Melnyk', {
    comment: 'API automation focus',
    total_percent: 100,
    status: 'allocated',
    allocations: [
      {
        id: 100,
        project: { id: 10, name: 'Payment Gateway', cluster_id: 1 },
        role: 'QC',
        percent: 100,
        start_date: '2026-09-01',
        end_date: null,
        status: 'active',
      },
    ],
  }),
  engineer(2, 'Maksym Bondar', { total_percent: 50, status: 'allocated' }),
  engineer(5, 'Kateryna Romanenko', {
    total_percent: 50,
    status: 'planned',
    allocations: [
      {
        id: 102,
        project: { id: 21, name: 'Data Platform', cluster_id: 2 },
        role: 'QC',
        percent: 50,
        start_date: '2026-10-01',
        end_date: '2026-12-31',
        status: 'planned',
      },
    ],
  }),
  engineer(6, 'Andrii Koval', { comment: 'Available for new project' }),
  engineer(7, 'Olena Kovalenko', {
    status: 'manager',
    managed_clusters: [{ id: 1, name: 'Payments' }],
  }),
]
