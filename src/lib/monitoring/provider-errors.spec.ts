import { APIError } from 'openai'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { classifyProviderError, reportProviderError } from './provider-errors'

/**
 * Bodies here are the ones the providers actually return — OpenAI's symbolic `code`, and Azure's
 * habit of echoing the HTTP status as the code and putting the cause in the message.
 */
function openAiError(status: number, body: object, headers: Record<string, string> = {}) {
    return APIError.generate(status, body, undefined, new Headers(headers))
}

describe('classifyProviderError', () => {
    describe('auth failures', () => {
        it('reports an invalid OpenAI key', () => {
            const error = openAiError(401, {
                error: {
                    message: 'Incorrect API key provided: sk-proj-***.',
                    type: 'invalid_request_error',
                    code: 'invalid_api_key',
                },
            })

            const report = classifyProviderError(error, { provider: 'openai' })

            expect(report).toEqual({
                kind: 'auth-failure',
                event: {
                    event: 'provider.auth.failure',
                    attributes: {
                        provider: 'openai',
                        statusCode: 401,
                        errorMessage: 'Incorrect API key provided: sk-proj-***.',
                        errorCode: 'invalid_api_key',
                    },
                },
            })
        })

        it('reports an invalid Azure subscription key, whose code is just the status', () => {
            const error = openAiError(401, {
                error: {
                    code: '401',
                    message:
                        'Access denied due to invalid subscription key or wrong API endpoint. ' +
                        'Make sure to provide a valid key for an active subscription and use a ' +
                        'correct regional API endpoint for your resource.',
                },
            })

            const report = classifyProviderError(error, {
                provider: 'azure-openai',
                model: 'gpt-4o-sales',
            })

            expect(report?.kind).toBe('auth-failure')
            expect(report).toMatchObject({
                event: {
                    attributes: {
                        provider: 'azure-openai',
                        // On Azure the model is the deployment name, so this is what points at the
                        // resource whose key needs replacing.
                        model: 'gpt-4o-sales',
                        statusCode: 401,
                        errorCode: '401',
                    },
                },
            })
        })

        it('treats 403 as an auth failure too', () => {
            const error = openAiError(403, {
                error: {
                    message: 'Country, region, or territory not supported',
                    code: 'unsupported_country_region_territory',
                },
            })

            expect(classifyProviderError(error, { provider: 'openai' })?.kind).toBe('auth-failure')
        })

        it('falls back to an unknown provider when the adapter does not say', () => {
            const error = openAiError(401, { error: { message: 'Invalid Authentication' } })

            expect(classifyProviderError(error)).toMatchObject({
                event: { attributes: { provider: 'unknown' } },
            })
        })
    })

    describe('quota exhaustion', () => {
        beforeEach(() => {
            vi.useFakeTimers({ now: new Date('2026-07-30T12:00:00Z') })
            return () => vi.useRealTimers()
        })

        it('reports OpenAI insufficient_quota', () => {
            const error = openAiError(429, {
                error: {
                    message:
                        'You exceeded your current quota, please check your plan and billing details.',
                    type: 'insufficient_quota',
                    code: 'credit_balance_exhausted',
                },
            })

            const report = classifyProviderError(error, { provider: 'openai', model: 'gpt-4o' })

            expect(report?.kind).toBe('quota-exceeded')
            expect(report).toMatchObject({
                event: {
                    event: 'provider.quota.exceeded',
                    attributes: {
                        provider: 'openai',
                        model: 'gpt-4o',
                        statusCode: 429,
                        errorCode: 'credit_balance_exhausted',
                    },
                },
            })
        })

        it('recognises Azure quota exhaustion from the message alone', () => {
            const error = openAiError(429, {
                error: { code: '429', message: 'You exceeded your current quota.' },
            })

            expect(classifyProviderError(error, { provider: 'azure-openai' })?.kind).toBe(
                'quota-exceeded',
            )
        })

        it('carries the exhausted dimension and its reset time from the headers', () => {
            const error = openAiError(
                429,
                {
                    error: {
                        message: 'You exceeded your current quota.',
                        type: 'insufficient_quota',
                    },
                },
                {
                    'x-ratelimit-limit-tokens': '150000',
                    'x-ratelimit-remaining-tokens': '0',
                    'x-ratelimit-reset-tokens': '6m0s',
                    'x-ratelimit-limit-requests': '500',
                    'x-ratelimit-remaining-requests': '499',
                    'x-ratelimit-reset-requests': '1s',
                },
            )

            expect(classifyProviderError(error, { provider: 'openai' })).toMatchObject({
                event: {
                    attributes: {
                        quotaName: 'tokens',
                        limit: 150000,
                        remaining: 0,
                        resetAt: new Date('2026-07-30T12:06:00Z').getTime(),
                    },
                },
            })
        })

        it('falls back to retry-after when no reset header is present', () => {
            const error = openAiError(
                429,
                { error: { message: 'You exceeded your current quota.' } },
                { 'retry-after': '30' },
            )

            expect(classifyProviderError(error, { provider: 'azure-openai' })).toMatchObject({
                event: { attributes: { resetAt: new Date('2026-07-30T12:00:30Z').getTime() } },
            })
        })
    })

    describe('ordinary throttling', () => {
        it('does not raise a quota event for OpenAI rate_limit_exceeded', () => {
            const error = openAiError(429, {
                error: {
                    message:
                        'Rate limit reached for gpt-4o in organization org-*** on tokens per min.',
                    type: 'requests',
                    code: 'rate_limit_exceeded',
                },
            })

            expect(classifyProviderError(error, { provider: 'openai' })).toEqual({
                kind: 'rate-limit',
                statusCode: 429,
                errorCode: 'rate_limit_exceeded',
                errorMessage:
                    'Rate limit reached for gpt-4o in organization org-*** on tokens per min.',
            })
        })

        it("does not raise a quota event for Azure's per-deployment token rate limit", () => {
            const error = openAiError(429, {
                error: {
                    code: '429',
                    message:
                        'Requests to the ChatCompletions_Create Operation under Azure OpenAI API ' +
                        'version 2024-10-21 have exceeded token rate limit of your current ' +
                        'OpenAI S0 pricing tier.',
                },
            })

            expect(classifyProviderError(error, { provider: 'azure-openai' })?.kind).toBe(
                'rate-limit',
            )
        })
    })

    describe('everything else', () => {
        it.each([
            ['a plain error', new Error('boom')],
            ['a string', 'boom'],
            ['null', null],
            ['a 500', openAiError(500, { error: { message: 'The server had an error' } })],
            ['a 400', openAiError(400, { error: { message: 'Invalid schema' } })],
        ])('ignores %s', (_label, error) => {
            expect(classifyProviderError(error, { provider: 'openai' })).toBeUndefined()
        })
    })
})

describe('reportProviderError', () => {
    const logger = { log: vi.fn(), debug: vi.fn(), error: vi.fn() }

    beforeEach(() => vi.clearAllMocks())

    it('emits the event through the tracer', () => {
        const eventTracer = { emit: vi.fn() }
        const error = openAiError(401, { error: { message: 'Invalid Authentication' } })

        reportProviderError(error, { logger, eventTracer, providerInfo: { provider: 'openai' } })

        expect(eventTracer.emit).toHaveBeenCalledWith(
            expect.objectContaining({ event: 'provider.auth.failure' }),
        )
    })

    it('logs throttling instead of emitting', () => {
        const eventTracer = { emit: vi.fn() }
        const error = openAiError(429, {
            error: { message: 'Rate limit reached', code: 'rate_limit_exceeded' },
        })

        reportProviderError(error, { logger, eventTracer, providerInfo: { provider: 'openai' } })

        expect(eventTracer.emit).not.toHaveBeenCalled()
        expect(logger.debug).toHaveBeenCalled()
    })

    it('works without a tracer', () => {
        const error = openAiError(401, { error: { message: 'Invalid Authentication' } })

        expect(() => reportProviderError(error, { logger })).not.toThrow()
    })

    it('swallows a failing tracer so monitoring cannot break the call path', () => {
        const eventTracer = {
            emit: vi.fn(() => {
                throw new Error('tracer is down')
            }),
        }
        const error = openAiError(401, { error: { message: 'Invalid Authentication' } })

        expect(() =>
            reportProviderError(error, {
                logger,
                eventTracer,
                providerInfo: { provider: 'openai' },
            }),
        ).not.toThrow()
        expect(logger.error).toHaveBeenCalled()
    })
})
