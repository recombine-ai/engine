import { inspect } from 'node:util'
import { Logger } from '../interfaces'

type ConstructorType<T> = new (...args: any[]) => T
type InstanceType<T extends ConstructorType<any>> = T extends new (...args: any[]) => infer R
    ? R
    : never

export function createMock<T extends ConstructorType<any>>(
    logger: Logger,
    constructor: T,
    overrides?: Partial<InstanceType<T>>,
): InstanceType<T> {
    const mock = Object.create(constructor.prototype) as InstanceType<T>
    const properties = Object.getOwnPropertyDescriptors(constructor.prototype)

    for (const [key, descriptor] of Object.entries(properties)) {
        if (typeof descriptor.value === 'function' && key !== 'constructor') {
            mock[key] = function (...args: any[]) {
                let returnValue: any = {}
                if (overrides && key in overrides && typeof overrides[key] === 'function') {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                    returnValue = overrides[key](...args) as ReturnType<InstanceType<T>[typeof key]>
                }
                const logs = [`${constructor.name}.${key}\n\tCalled with:`, prettyArgs(args)]
                if (returnValue) {
                    logs.push(`\n\tReturning: ${prettyInspect(returnValue)}`)
                }
                logger.log(...logs)
                return returnValue
            }
        }
    }

    return mock
}

function prettyArgs(args: any[]) {
    return args.map((arg) => (typeof arg === 'object' ? prettyInspect(arg) : arg)).join(' ')
}

function prettyInspect(obj: any) {
    return inspect(obj, { depth: null }).split('\n').join('\n\t')
}
