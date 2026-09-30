interface ConsentCardProps {
    tone: 'does' | 'doesnt';
    heading: string;
    body: string;
}

const TONE = {
    does: {
        surface: 'bg-[var(--accent-2-100)]',
        label: 'text-[var(--accent-2-800)]',
        body: 'text-[var(--accent-2-900)]',
        stroke: 'var(--accent-2-800)',
    },
    doesnt: {
        surface: 'bg-[var(--neutral-200)]',
        label: 'text-[var(--neutral-800)]',
        body: 'text-[var(--neutral-800)]',
        stroke: 'var(--neutral-700)',
    },
} as const;

export function ConsentCard({ tone, heading, body }: ConsentCardProps) {
    const styles = TONE[tone];

    return (
        <div className={`rounded-[22px] px-[18px] py-4 ${styles.surface}`}>
            <div className="mb-2 flex items-center gap-2">
                <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={styles.stroke}
                    strokeWidth="2.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                >
                    {tone === 'does' ? (
                        <path d="M20 6 9 17l-5-5" />
                    ) : (
                        <>
                            <circle cx="12" cy="12" r="9" />
                            <path d="M8.5 12h7" />
                        </>
                    )}
                </svg>
                <span
                    className={`text-[12.5px] font-bold tracking-[0.02em] ${styles.label}`}
                >
                    {heading}
                </span>
            </div>
            <p className={`m-0 text-[14px] leading-[1.55] ${styles.body}`}>
                {body}
            </p>
        </div>
    );
}
