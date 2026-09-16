'use client' // Error boundaries must be Client Components

import { ErrorDisplay } from '@/shared/components/error/ErrorDisplay'

export default function InstanceErrorPage({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    return (
        <ErrorDisplay
            title="Something went wrong!"
            message="We encountered an unexpected error while loading this page."
            errorDetail={error.message}
            onRetry={() => reset()}
        />
    )
}