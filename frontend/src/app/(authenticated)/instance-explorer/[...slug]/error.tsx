'use client' // Error boundaries must be Client Components

import { ErrorDisplay } from '@/shared/components/error/ErrorDisplay'

export default function InstanceErrorPage({
    error,
    unstable_retry,
}: {
    error: Error & { digest?: string }
    unstable_retry: () => void
}) {
    return (
        <ErrorDisplay
            title="Something went wrong!"
            message="We encountered an unexpected error while loading this segment."
            errorDetail={error.message}
            onRetry={() => unstable_retry()}
        />
    )
}