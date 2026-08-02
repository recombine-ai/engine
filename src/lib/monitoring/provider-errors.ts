import type { EventTracer, MonitoringEvent } from '@recombine-ai/telescope'
import type { LlmProviderInfo } from '../interfaces/adapter'
import type { Logger } from '../interfaces/other'

/**
 * Turns provider (OpenAI / Azure OpenAI) failures into monitoring events.
 *
 * Everything here duck-types rather than using `instanceof APIError`. The engine and its host can
 * end up with separate copies of the `openai` package, which makes `instanceof` silently false, and
 * a monitoring signal that quietly stops firing is worse than one that is slightly permissive.
 */

/**
 * Symbolic codes both providers use for "you are out of quota", as opposed to "slow down".
 *
 * Every one is a 429, and `error.type` stays `insufficient_quota` throughout — the docs direct you
 * to read `error.code` for the actual cause, which is why both fields are checked below.
 *
 * @see https://developers.openai.com/api/docs/guides/error-codes
 * @see https://developers.openai.com/api/docs/guides/spend-limits
 */
const QUOTA_ERROR_CODES = new Set([
    'insufficient_quota', // the `type` shared by all of the below
    'credit_balance_exhausted', // docs: "Credit balance exhausted"
    'organization_spend_limit_exceeded', // docs: "Organization spend limit reached"
    'project_spend_limit_exceeded', // docs: "Project spend limit reached"
    'organization_usage_limit_exceeded', // docs: "Organization usage limit reached"
    // Unsourced: absent from the current error-codes page, and only ever seen in community reports.
    // Presumed to predate the spend-limit codes above (the old per-account "hard limit" billing
    // model). Harmless to keep as a safety net, but delete it if no real 429 ever carries it.
    'billing_hard_limit_reached',
])

/**
 * Fallback for providers that return the HTTP status as the code and put the cause in the message —
 * Azure answers a bad key with `{"error":{"code":"401","message":"Access denied due to invalid
 * subscription key or wrong API endpoint..."}}`, so its quota errors are only distinguishable by
 * wording.
 *
 * Where each alternative comes from:
 *   `exceeded your current quota` — OpenAI's 429 body, "You exceeded your current quota, please
 *                                   check your plan and billing details"
 *   `insufficient[_ ]quota`       — the `error.type` above, also seen spelled out in prose
 *   `spend limit` / `usage limit` — the documented messages for the three limit codes above
 *   `no prepaid credits`          — the docs' wording for `credit_balance_exhausted` ("no prepaid
 *                                   credits remaining"); the returned message is the shorter
 *                                   "Credit balance exhausted", so this may only ever match prose
 *   `billing hard limit`          — unsourced, paired with `billing_hard_limit_reached` above
 *
 * Kept narrow so ordinary throttling does not match: Azure's throttle reads "Requests to the
 * ChatCompletions_Create Operation ... have exceeded token rate limit of your current OpenAI S0
 * pricing tier". Note how close that runs to the first alternative — it says "exceeded", "your
 * current" and "limit", and is only missed because none of those sit together in the matched form.
 * Widening any alternative here risks swallowing the throttle case.
 *
 * @see https://developers.openai.com/api/docs/guides/error-codes
 */
const QUOTA_MESSAGE =
    /exceeded your current quota|insufficient[_ ]quota|no prepaid credits|billing hard limit|spend limit|usage limit/i

type ApiErrorLike = {
    status?: unknown
    code?: unknown
    type?: unknown
    message?: unknown
    headers?: unknown
    error?: { code?: unknown; type?: unknown; message?: unknown }
}

type ErrorFields = {
    statusCode: number
    errorCode?: string
    errorType?: string
    errorMessage: string
}

export type ProviderErrorReport =
    | { kind: 'auth-failure' | 'quota-exceeded'; event: MonitoringEvent }
    /**
     * Ordinary throttling. Reported back so the caller can log it, but deliberately not a monitoring
     * event: it clears itself within the window and would bury the quota signal it looks like.
     */
    | { kind: 'rate-limit'; statusCode: number; errorCode?: string; errorMessage: string }

/**
 * Classifies a thrown value as a provider auth/quota failure, or returns `undefined` if it is
 * anything else (a bug in a step, a network drop, a malformed response).
 */
export function classifyProviderError(
    error: unknown,
    providerInfo?: LlmProviderInfo,
): ProviderErrorReport | undefined {
    const fields = readErrorFields(error)
    if (!fields) return undefined

    const { statusCode, errorCode, errorType, errorMessage } = fields
    // `unknown` rather than dropping the event: an expired key still has to page someone even when
    // the adapter did not say who it belongs to.
    const provider = providerInfo?.provider ?? 'unknown'

    // 401 is a bad/expired/revoked key; 403 is a real key without entitlement (wrong deployment,
    // unsupported region, IP not allow-listed). Neither recovers on its own.
    if (statusCode === 401 || statusCode === 403) {
        return {
            kind: 'auth-failure',
            event: {
                event: 'provider.auth.failure',
                attributes: {
                    provider,
                    model: providerInfo?.model,
                    statusCode,
                    errorMessage,
                    errorCode,
                },
            },
        }
    }

    if (statusCode === 429) {
        const isQuota =
            (errorCode !== undefined && QUOTA_ERROR_CODES.has(errorCode)) ||
            (errorType !== undefined && QUOTA_ERROR_CODES.has(errorType)) ||
            QUOTA_MESSAGE.test(errorMessage)

        if (!isQuota) {
            return { kind: 'rate-limit', statusCode, errorCode, errorMessage }
        }

        return {
            kind: 'quota-exceeded',
            event: {
                event: 'provider.quota.exceeded',
                attributes: {
                    provider,
                    model: providerInfo?.model,
                    statusCode,
                    errorMessage,
                    errorCode: errorCode ?? errorType,
                    ...readQuotaHeaders(error),
                },
            },
        }
    }

    return undefined
}

/**
 * Classifies `error` and emits the matching monitoring event. Never throws: monitoring must not be
 * able to turn a provider outage into a second, different failure.
 */
export function reportProviderError(
    error: unknown,
    deps: { logger: Logger; eventTracer?: EventTracer; providerInfo?: LlmProviderInfo },
): ProviderErrorReport | undefined {
    try {
        const report = classifyProviderError(error, deps.providerInfo)
        if (!report) return undefined

        if (report.kind === 'rate-limit') {
            deps.logger.debug('LLM provider rate limited the request', {
                statusCode: report.statusCode,
                errorCode: report.errorCode,
                provider: deps.providerInfo?.provider,
            })
            return report
        }

        deps.eventTracer?.emit(report.event)
        return report
    } catch (reportingError) {
        deps.logger.error('Failed to report provider error', { error: reportingError })
        return undefined
    }
}

function readErrorFields(error: unknown): ErrorFields | undefined {
    if (typeof error !== 'object' || error === null) return undefined

    const candidate = error as ApiErrorLike
    const statusCode = candidate.status
    if (typeof statusCode !== 'number') return undefined

    // The SDK lifts `code`/`type` onto the error, but only when the body parsed; the nested `error`
    // object is the raw body and is what Azure populates.
    const errorCode = firstString(candidate.code, candidate.error?.code)
    const errorType = firstString(candidate.type, candidate.error?.type)
    const errorMessage =
        firstString(candidate.error?.message, candidate.message) ?? `HTTP ${statusCode}`

    return { statusCode, errorCode, errorType, errorMessage }
}

/**
 * Pulls limit/remaining/reset off the provider's `x-ratelimit-*` headers. Both providers send them
 * per dimension (tokens and requests); we report the exhausted one, since that is the ceiling that
 * caused the rejection.
 *
 * Header names are the documented set — `x-ratelimit-{limit,remaining,reset}-{requests,tokens}`.
 * There are project-scoped variants too (`x-ratelimit-limit-project-tokens` and friends) that we do
 * not read.
 *
 * @see https://developers.openai.com/api/docs/guides/rate-limits
 */
function readQuotaHeaders(error: unknown): {
    quotaName?: string
    limit?: number
    remaining?: number
    resetAt?: number
} {
    const headers = (error as ApiErrorLike | null)?.headers
    const get = (name: string): string | undefined => {
        const value = (headers as { get?: (name: string) => unknown } | undefined)?.get?.(name)
        return typeof value === 'string' ? value : undefined
    }
    if (typeof (headers as { get?: unknown } | undefined)?.get !== 'function') return {}

    const dimensions = (['tokens', 'requests'] as const).map((dimension) => ({
        quotaName: dimension,
        limit: toNumber(get(`x-ratelimit-limit-${dimension}`)),
        remaining: toNumber(get(`x-ratelimit-remaining-${dimension}`)),
        reset: get(`x-ratelimit-reset-${dimension}`),
    }))

    const exhausted =
        dimensions.find((d) => d.remaining === 0) ??
        dimensions.find((d) => d.limit !== undefined || d.remaining !== undefined)

    // `retry-after` is the only hint Azure gives on a throttled deployment, and the only one either
    // provider gives when the ceiling was a billing one rather than a rate one. `retry-after-ms` is
    // non-standard; we read it first for the same reason the OpenAI SDK does — see its own retry
    // logic in `openai/src/client.ts`, which tries `retry-after-ms` before falling back to
    // `retry-after` (documented as "the minimum number of seconds to wait before retrying").
    const retryAfterMs =
        toNumber(get('retry-after-ms')) ?? secondsToMs(toNumber(get('retry-after')))
    const resetMs = exhausted?.reset ? parseResetDuration(exhausted.reset) : undefined
    const delayMs = resetMs ?? retryAfterMs

    return {
        quotaName: exhausted?.quotaName,
        limit: exhausted?.limit,
        remaining: exhausted?.remaining,
        resetAt: delayMs === undefined ? undefined : Date.now() + delayMs,
    }
}

/**
 * Parses OpenAI's reset format — `1s`, `6m0s`, `500ms` — into milliseconds. `1s` and `6m0s` are the
 * examples the rate-limit docs give; `ms` is not shown there but is emitted in practice, hence the
 * ordering note below.
 *
 * @see https://developers.openai.com/api/docs/guides/rate-limits
 */
function parseResetDuration(value: string): number | undefined {
    const units: Record<string, number> = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }
    let total: number | undefined = undefined

    // `ms` is listed before the single-letter units so `500ms` is not read as 500 minutes.
    for (const [, amount, unit] of value.matchAll(/(\d+(?:\.\d+)?)(ms|[smhd])/g)) {
        total = (total ?? 0) + Number(amount) * units[unit]
    }
    return total
}

function firstString(...values: unknown[]): string | undefined {
    return values.find((value): value is string => typeof value === 'string' && value.length > 0)
}

function toNumber(value: string | undefined): number | undefined {
    if (value === undefined) return undefined
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
}

function secondsToMs(seconds: number | undefined): number | undefined {
    return seconds === undefined ? undefined : seconds * 1000
}
