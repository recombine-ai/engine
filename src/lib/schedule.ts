/**
 * @returns getNextTimePoint function that makes a date from a given {@link Delay}
 * - note that Delay must not be negative
 */
export function delayFactory(schedule: Schedule) {
    return function getNextTimePoint(delay: Delay): Date {
        const date = new Date()
        const { holidays, timeZone, workingHours } = schedule

        const delayMs = getDelayTimeInMs(delay)

        const [_, offsetDiffBefore] = convertToTimeZone(date, timeZone)
        const localOffsetBefore = date.getTimezoneOffset() * 60 * 1000

        date.setTime(date.getTime() + delayMs)

        let [targetTzDate, offsetDiff] = convertToTimeZone(date, timeZone)
        const localOffsetAfterMs = targetTzDate.getTimezoneOffset() * 60 * 1000
        const localOffsetChange = localOffsetAfterMs - localOffsetBefore
        const targetTzOffsetChange = offsetDiff - offsetDiffBefore

        if (workingHours && workingHours?.length > 0) {
            targetTzDate = getNextWorkingDate(targetTzDate, workingHours)
        }

        if (holidays && isHoliday(targetTzDate, holidays)) {
            targetTzDate = skipHoliday(targetTzDate, holidays)
        }

        const targetDate = new Date(
            targetTzDate.getTime() + offsetDiff + targetTzOffsetChange + localOffsetChange,
        )

        const [, offsetDiffTz] = convertToTimeZone(targetDate, timeZone)

        const targetOffsetTzChange = offsetDiffTz - offsetDiff

        return new Date(
            targetTzDate.getTime() +
                offsetDiff +
                targetTzOffsetChange +
                localOffsetChange +
                targetOffsetTzChange,
        )
    }
}

function getDelayTimeInMs(time: Delay): number {
    const minutesIndex = time.findIndex((el) => el === 'minutes')
    const minutes = minutesIndex !== -1 ? (time[minutesIndex - 1] as number) : 0
    const hoursIndex = time.findIndex((el) => el === 'hours')
    const hours = hoursIndex !== -1 ? (time[hoursIndex - 1] as number) : 0
    const daysIndex = time.findIndex((el) => el === 'days')
    const days = daysIndex !== -1 ? (time[daysIndex - 1] as number) : 0

    if ([days, hours, minutes].some((v) => v < 0)) {
        throw new Error('Negative delay')
    }

    return (minutes * 60 + hours * 60 * 60 + days * 24 * 60 * 60) * 1000
}

function convertToTimeZone(date: Date, timeZone: string) {
    const convertedDate = new Date(date.toLocaleString('en-US', { timeZone }))
    const offsetMS = date.getTime() - convertedDate.getTime()
    return [convertedDate, offsetMS] as [Date, number]
}

function getNextWorkingDate(date: Date, workingHours: TimeRange[]): Date {
    const currentDate = new Date(date)

    while (true) {
        const currentDay = getDayOfWeek(currentDate)

        const daySchedule = workingHours.find((interval) => interval.days.includes(currentDay))

        if (daySchedule) {
            const [fromHours, fromMinutes] = daySchedule.from.split(':').map(Number)
            const [toHours, toMinutes] = daySchedule.to.split(':').map(Number)

            if (fromHours > toHours) {
                throw new Error('"from" is later then "to"')
            }

            const startTime = new Date(currentDate)
            startTime.setHours(fromHours, fromMinutes, 0, 0)

            const endTime = new Date(currentDate)
            endTime.setHours(toHours, toMinutes, 0, 0)

            if (currentDate >= startTime && currentDate <= endTime) {
                return currentDate
            } else if (currentDate < startTime) {
                return startTime
            }
        }

        currentDate.setDate(currentDate.getDate() + 1)
        currentDate.setHours(0, 0, 0, 0)
    }
}

function getDayOfWeek(date: Date): WeekDays {
    const days: WeekDays[] = [
        'sunday',
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
    ]
    return days[date.getDay()]
}

function isHoliday(date: Date, holidays: DateFmt[]): boolean {
    const dateString = date.toISOString().split('T')[0]
    return holidays.includes(dateString as DateFmt)
}

function skipHoliday(date: Date, holidays: DateFmt[]): Date {
    while (isHoliday(date, holidays)) {
        date.setDate(date.getDate() + 1)
    }
    return date
}

type Delay =
    | [number, 'minutes' | 'hours' | 'days']
    | [number, 'hours', number, 'minutes']
    | [number, 'days', number, 'hours']
    | [number, 'days', number, 'hours', number, 'minutes']

type singleInt = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
type hours = `${0 | 1}${singleInt}` | '20' | '21' | '22' | '23'
type Time = `${hours}:${0 | 1 | 2 | 3 | 4 | 5}${singleInt}`
type WeekDays = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
type Year = 2024 | 2025 | 2026 | 2027 | 2028 | 2029 | 2030
type Month = '01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09' | '10' | '11' | '12'

type DateFmt = `${Year}-${Month}-${0 | 1 | 2 | 3}${singleInt}`

interface TimeRange {
    days: WeekDays[]
    from: Time
    to: Time
}

export interface Schedule {
    timeZone: string
    workingHours?: TimeRange[]
    holidays?: DateFmt[]
}
