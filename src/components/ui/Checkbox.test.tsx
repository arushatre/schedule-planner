import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { Checkbox } from './Checkbox'

function Harness() {
  const [checked, setChecked] = useState(false)
  return <Checkbox checked={checked} onChange={setChecked} label="Finish essay" />
}

describe('Checkbox', () => {
  it('toggles through its accessible label', async () => {
    render(<Harness />)
    const box = screen.getByRole('checkbox', { name: 'Finish essay' })
    expect(box).not.toBeChecked()
    await userEvent.click(screen.getByText('Finish essay'))
    expect(box).toBeChecked()
  })

  it('does not toggle when disabled', async () => {
    render(<Checkbox checked={false} onChange={() => undefined} label="Locked" disabled />)
    expect(screen.getByRole('checkbox', { name: 'Locked' })).toBeDisabled()
  })
})
