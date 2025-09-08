import fs from 'fs'
import { join } from 'path'
import { Logger } from './interfaces'

export interface FsConfig {
    logger?: Logger
    basePath: string
}

export interface PromptFS {
    loadFile(path: string): PromptFile
}

export function createLocalFS(cfg: FsConfig) {
    const logger = cfg.logger ?? console
    return {
        loadFile(path: string): PromptFile {
            return {
                type: 'file',
                content: async () => {
                    logger.debug('AI Engine: loading prompt:', path)
                    return fs.promises.readFile(join(cfg.basePath, path), 'utf-8')
                },
                path,
            }
        },
    }
}

export interface PromptFile {
    type: 'file'
    content: () => Promise<string>
    path: string
}
