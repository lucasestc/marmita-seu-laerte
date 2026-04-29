/**
 * P0-011  6 boxes auto-advance on digit entry
 * P0-012  Backspace navigates to previous box
 * P0-013  Paste fills all 6 boxes
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { OtpInput } from '@/components/ui/otp-input'

function Controlled(props: { disabled?: boolean; hasError?: boolean }) {
  const [value, setValue] = useState('')
  return <OtpInput value={value} onChange={setValue} {...props} />
}

function boxes() {
  return screen.getAllByRole('textbox')
}

describe('OtpInput', () => {
  it('renders 6 input boxes with aria-labels', () => {
    render(<Controlled />)
    expect(boxes()).toHaveLength(6)
    expect(screen.getByLabelText('Dígito 1 de 6')).toBeInTheDocument()
    expect(screen.getByLabelText('Dígito 6 de 6')).toBeInTheDocument()
  })

  it('[P0-011] typing a digit auto-advances focus to the next box', async () => {
    const user = userEvent.setup()
    render(<Controlled />)
    const inputs = boxes()

    await user.click(inputs[0])
    await user.keyboard('3')

    expect(inputs[0]).toHaveValue('3')
    expect(document.activeElement).toBe(inputs[1])
  })

  it('[P0-011] typing 6 digits fills all boxes sequentially', async () => {
    const user = userEvent.setup()
    render(<Controlled />)
    const inputs = boxes()

    await user.click(inputs[0])
    await user.keyboard('123456')

    inputs.forEach((input, i) => {
      expect(input).toHaveValue(String(i + 1))
    })
  })

  it('[P0-012] backspace on empty box moves focus to previous', async () => {
    const user = userEvent.setup()
    render(<Controlled />)
    const inputs = boxes()

    // Fill first two boxes
    await user.click(inputs[0])
    await user.keyboard('12')
    // Focus is now on box 2; backspace clears it and stays on 2
    await user.keyboard('{Backspace}')
    expect(inputs[1]).toHaveValue('')
    // Backspace again on now-empty box 2 moves to box 1
    await user.keyboard('{Backspace}')
    expect(document.activeElement).toBe(inputs[0])
  })

  it('[P0-012] backspace on filled box clears it without moving focus', async () => {
    const user = userEvent.setup()
    render(<Controlled />)
    const inputs = boxes()

    await user.click(inputs[0])
    await user.keyboard('5')
    // Focus advanced to box 1; go back and test backspace clears box 0
    await user.click(inputs[0])
    await user.keyboard('{Backspace}')
    expect(inputs[0]).toHaveValue('')
  })

  it('[P0-013] paste fills all 6 boxes', async () => {
    const user = userEvent.setup()
    render(<Controlled />)
    const inputs = boxes()

    await user.click(inputs[0])
    await user.paste('654321')

    inputs.forEach((input, i) => {
      expect(input).toHaveValue(String(6 - i))
    })
  })

  it('[P0-013] paste strips non-digit characters', async () => {
    const user = userEvent.setup()
    render(<Controlled />)
    const inputs = boxes()

    await user.click(inputs[0])
    await user.paste('1a2b3c4')

    expect(inputs[0]).toHaveValue('1')
    expect(inputs[1]).toHaveValue('2')
    expect(inputs[2]).toHaveValue('3')
    expect(inputs[3]).toHaveValue('4')
  })

  it('disabled prop disables all inputs', () => {
    render(<Controlled disabled />)
    boxes().forEach((input) => expect(input).toBeDisabled())
  })

  it('hasError does not change the number of inputs', () => {
    render(<Controlled hasError />)
    expect(boxes()).toHaveLength(6)
  })

  it('onChange is not called when disabled', async () => {
    const onChange = vi.fn()
    render(<OtpInput value="" onChange={onChange} disabled />)
    await userEvent.type(boxes()[0], '5')
    expect(onChange).not.toHaveBeenCalled()
  })
})
