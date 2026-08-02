// cspell:words Nagle's
import OpenAI, { AzureOpenAI } from 'openai'
import { Client as HttpClient } from 'undici'
import { Logger } from '../interfaces'

interface AzureConfig {
    endpoint: string
    apiVersion: string
    deployment: string
    apiKey: string
}

interface OpenAiConfig {
    apiKey: string
}

export function getAzureClient(logger: Logger, config: AzureConfig) {
    logger.debug(`getting azure client: ${config.endpoint}, v: ${config.apiVersion}`)
    return new AzureOpenAI({
        apiKey: config.apiKey,
        apiVersion: config.apiVersion,
        endpoint: config.endpoint,
        deployment: config.deployment,
        fetch: getOptimizedFetch(logger, new URL(config.endpoint).origin),
    })
}
export function getOpenAiClient(logger: Logger, config: OpenAiConfig) {
    logger.debug(`getting OpenAi client.`)
    return new OpenAI({
        apiKey: config.apiKey,
        fetch: getOptimizedFetch(logger, 'https://api.openai.com'),
    })
}

function getOptimizedFetch(logger: Logger, url: string) {
    const defaultHeaders = {
        'content-type': 'application/json',
        accept: 'application/json',
        connection: 'keep-alive',
    } as const
    const httpClient = new HttpClient(url, {
        // Keep connections alive for reuse
        keepAliveTimeout: 120_000,
        keepAliveMaxTimeout: 300_000,
        // HTTP/1.1 pipelining for multiple requests
        pipelining: 10,
        // TCP socket optimizations
        connect: {
            // Disable Nagle's algorithm for lower latency
            noDelay: true,
            // Keep socket alive
            keepAlive: true,
            // Skip SSL verification for trusted API endpoints
            rejectUnauthorized: false,
        },
        // DNS caching
        maxCachedSessions: 100,
        // Timeout optimizations
        headersTimeout: 30000,
        bodyTimeout: 60000,
    })

    process.on('SIGTERM', () => {
        void httpClient.close()
    })
    process.on('SIGINT', () => {
        void httpClient.close()
    })

    async function customFetch(
        url: string | URL | Request,
        options: RequestInit = {},
    ): Promise<Response> {
        const requestUrl = url instanceof Request ? url.url : url.toString()
        const method = options.method || 'GET'
        logger.debug('Optimized Fetch', { method, url })
        const originalHeaders =
            options.headers instanceof Headers
                ? Object.fromEntries(options.headers.entries())
                : options.headers
        const headers = {
            ...defaultHeaders,
            ...(originalHeaders || {}),
        }

        const response = await httpClient.request({
            path: new URL(requestUrl).pathname + new URL(requestUrl).search,
            method,
            headers,
            body: options.body as string,
            origin: new URL(requestUrl).origin,
        })

        // Convert undici headers to standard Headers
        const responseHeaders = new Headers()
        Object.entries(response.headers).forEach(([key, value]) => {
            if (Array.isArray(value)) {
                value.forEach((v) => responseHeaders.append(key, v))
            } else if (value !== undefined) {
                responseHeaders.append(key, value)
            }
        })

        if (response.statusCode === 429) {
            // Could be either throttling or genuine quota exhaustion — the SDK will throw and
            // `reportProviderError` makes that call from the error body. This is only a breadcrumb.
            logger.debug('LLM provider returned 429', { url: requestUrl })
        }

        // Create a proper Response with streaming support
        let canceled = false
        return new Response(
            new ReadableStream({
                cancel() {
                    canceled = true
                },
                start(controller) {
                    response.body.on('data', (chunk) => {
                        if (canceled) return
                        try {
                            controller.enqueue(chunk)
                        } catch (e) {
                            logger.error(e)
                        }
                    })

                    response.body.on('end', () => {
                        if (canceled) return
                        try {
                            controller.close()
                        } catch (e) {
                            logger.error(e)
                        }
                    })

                    response.body.on('error', (err) => {
                        if (canceled) return
                        try {
                            controller.error(err)
                        } catch (e) {
                            logger.error(e)
                        }
                    })
                },
            }),
            {
                status: response.statusCode,
                headers: responseHeaders,
            },
        )
    }

    return customFetch
}
