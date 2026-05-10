import { ProgrammaticFilter } from './interfaces'

/**
 * filter out 'Agent:' at the beginning of the llm response
 */
export const defaultFilter: ProgrammaticFilter = {
    shouldStartFiltering(state, newToken) {
        return state.currentResponse.trim().length === 0 && newToken.toLowerCase() === 'agent'
    },
    onNewToken(_state, filteredTokens) {
        if (filteredTokens.length >= 2 && filteredTokens[1] === ':') {
            return { action: 'RELEASE_TOKENS', tokens: filteredTokens.slice(2) }
        }

        return { action: 'RELEASE_TOKENS', tokens: filteredTokens }
    },
    onStreamEnd(_state, filteredTokens) {
        return { tokensToRelease: filteredTokens }
    },
}
