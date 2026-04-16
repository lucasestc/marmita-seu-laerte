'use client'

type Props = {
  value: number        // currently selected stars (0 = none)
  onChange: (stars: number) => void
  disabled?: boolean
}

/**
 * 1–5 star selector.
 * Each star button meets the 44×44px minimum touch target size (Story 5.1 AC).
 */
export function StarRating({ value, onChange, disabled = false }: Props) {
  return (
    <div className="flex gap-1" role="group" aria-label="Avaliação em estrelas">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          onClick={() => onChange(star)}
          aria-label={`${star} estrela${star > 1 ? 's' : ''}`}
          aria-pressed={value >= star}
          className="flex items-center justify-center w-[44px] h-[44px] text-3xl leading-none transition-transform active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span aria-hidden="true">{value >= star ? '★' : '☆'}</span>
        </button>
      ))}
    </div>
  )
}
