'use client' // Error boundaries must be Client Components

import { ErrorDisplay } from '@/shared/components/error/ErrorDisplay'

export default function InstanceExplorerErrorPage({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    return (
        <ErrorDisplay
            title="Something went wrong!"
            message="We encountered an unexpected error in the Instance Explorer."
            errorDetail={error.message}
            onRetry={() => reset()}
        />
    )
}
