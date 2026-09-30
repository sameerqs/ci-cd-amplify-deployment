'use client'


type Props = {
  error: { message?: string } | undefined | null
  id?: string
}

export default function FormError({ error, id }: Props) {
  if (!error) return null
  return (
    <p id={id} className="text-sm text-destructive mt-1" role="alert">
      {error.message}
    </p>
  )
}
