import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { App } from './App'

describe('App shell', () => {
  it('lands on Today and navigates between views', async () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1, name: 'Today' })).toBeInTheDocument()

    const [listNav] = screen.getAllByRole('button', { name: 'List' })
    if (!listNav) throw new Error('List nav button missing')
    await userEvent.click(listNav)
    expect(screen.getByRole('heading', { level: 1, name: 'List' })).toBeInTheDocument()
  })
})
