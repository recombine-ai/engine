import { AzureOpenAI, OpenAI } from 'openai'
import type { MonitoringProvider } from '@recombine-ai/telescope'

/**
 * Tells an Azure client apart from a plain OpenAI one. Both are driven through the same SDK — and
 * `AzureOpenAI extends OpenAI`, so the subclass has to be tested first — but they authenticate
 * against different accounts with separately expiring keys, which is exactly the distinction an
 * on-call engineer needs from a `provider.auth.failure`.
 */
export function detectProvider(client: OpenAI): MonitoringProvider {
    if (client instanceof AzureOpenAI) return 'azure-openai'

    // Falls back to the base URL, because a client constructed by a *different* copy of the `openai`
    // package fails the `instanceof` above. Azure endpoints are per-resource, so match on the
    // Microsoft-owned suffixes rather than a fixed host.
    const baseURL = client.baseURL ?? ''
    if (/\.(openai\.azure\.com|azure-api\.net|cognitiveservices\.azure\.com)/i.test(baseURL)) {
        return 'azure-openai'
    }

    return 'openai'
}
