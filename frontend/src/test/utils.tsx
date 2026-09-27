import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router'
import { vi } from 'vitest'

export function renderWithProviders(ui: ReactElement, { route = '/' } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

type Handler = (init: RequestInit | undefined, url: string) => { status?: number; body?: unknown }

/**
 * Minimal fetch mock: routes are matched by "METHOD /path" (path without the /api/v1 prefix).
 * Returns the mock so tests can assert on the requests that were made.
 */
export function mockApi(routes: Record<string, Handler | object>) {
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input)
    const path = url.replace(/^.*\/api\/v1/, '').split('?')[0]
    const key = `${init?.method ?? 'GET'} ${path}`
    const route = routes[key]
    if (!route) {
      return new Response(JSON.stringify({ error: { code: 'not_found', message: key } }), {
        status: 404,
      })
    }
    const result = typeof route === 'function' ? (route as Handler)(init, url) : { body: route }
    const status = result.status ?? 200
    return new Response(status === 204 ? null : JSON.stringify(result.body ?? null), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

export function requestBody(fetchMock: ReturnType<typeof mockApi>, key: string): unknown {
  const call = fetchMock.mock.calls.find(
    ([input, init]) =>
      `${init?.method ?? 'GET'} ${String(input).replace(/^.*\/api\/v1/, '')}` === key,
  )
  return call?.[1]?.body ? JSON.parse(String(call[1].body)) : undefined
}
