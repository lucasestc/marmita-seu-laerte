import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StarRating } from '@/components/features/StarRating'

describe('StarRating', () => {
  it('renders 5 buttons', () => {
    render(<StarRating value={0} onChange={() => {}} />)
    expect(screen.getAllByRole('button')).toHaveLength(5)
  })

  it('buttons have accessible labels (1–5 estrelas)', () => {
    render(<StarRating value={0} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: '1 estrela' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '2 estrelas' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '5 estrelas' })).toBeInTheDocument()
  })

  it('marks stars up to value as pressed', () => {
    render(<StarRating value={3} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: '1 estrela' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '3 estrelas' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '4 estrelas' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: '5 estrelas' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onChange with the clicked star value', async () => {
    const onChange = vi.fn()
    render(<StarRating value={0} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: '4 estrelas' }))
    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange).toHaveBeenCalledWith(4)
  })

  it('does not call onChange when disabled', async () => {
    const onChange = vi.fn()
    render(<StarRating value={0} onChange={onChange} disabled />)
    await userEvent.click(screen.getByRole('button', { name: '3 estrelas' }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('disables all buttons when disabled prop is set', () => {
    render(<StarRating value={0} onChange={() => {}} disabled />)
    screen.getAllByRole('button').forEach((btn) => {
      expect(btn).toBeDisabled()
    })
  })

  it('shows filled stars for selected values', () => {
    const { container } = render(<StarRating value={2} onChange={() => {}} />)
    const stars = container.querySelectorAll('[aria-hidden="true"]')
    expect(stars[0]).toHaveTextContent('★')
    expect(stars[1]).toHaveTextContent('★')
    expect(stars[2]).toHaveTextContent('☆')
    expect(stars[3]).toHaveTextContent('☆')
    expect(stars[4]).toHaveTextContent('☆')
  })
})
