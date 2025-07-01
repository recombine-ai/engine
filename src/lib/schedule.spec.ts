import { describe, expect, it, vi, beforeEach } from 'vitest'
import { Schedule, createScheduleQuery } from './schedule'

describe('ScheduleQuery', () => {
    describe('.nextValidDate', () => {
        describe('with delay', () => {
            describe('delay format', () => {
                beforeEach(() => {
                    vi.useFakeTimers({
                        now: new Date('2024-09-16T09:00:00+01:00'),
                    })
                })
                const schedule: Schedule = {
                    timeZone: 'Europe/London',
                }
                it('sets for 2 hours', () => {
                    const targetDate = new Date('2024-09-16T11:00:00+01:00')
                    const result = createScheduleQuery(schedule).nextValidDate([2, 'hours'])
                    expect(result.toLocaleString('en-US', schedule)).toBe(
                        targetDate.toLocaleString('en-US', schedule),
                    )
                })
                it('sets for 12 minutes', () => {
                    const targetDate = new Date('2024-09-16T09:12:00+01:00')
                    const result = createScheduleQuery(schedule).nextValidDate([12, 'minutes'])
                    expect(result.toLocaleString('en-US', schedule)).toBe(
                        targetDate.toLocaleString('en-US', schedule),
                    )
                })
                it('sets for 3 days', () => {
                    const targetDate = new Date('2024-09-19T09:00:00+01:00')
                    const result = createScheduleQuery(schedule).nextValidDate([3, 'days'])
                    expect(result.toLocaleString('en-US', schedule)).toBe(
                        targetDate.toLocaleString('en-US', schedule),
                    )
                })
                it('sets for 2 hours 23 minutes', () => {
                    const targetDate = new Date('2024-09-16T11:23:00+01:00')
                    const result = createScheduleQuery(schedule).nextValidDate([
                        2,
                        'hours',
                        23,
                        'minutes',
                    ])
                    expect(result.toLocaleString('en-US', schedule)).toBe(
                        targetDate.toLocaleString('en-US', schedule),
                    )
                })
                it('sets for 2 days and 3 hours', () => {
                    const targetDate = new Date('2024-09-18T12:00:00+01:00')
                    const result = createScheduleQuery(schedule).nextValidDate([
                        2,
                        'days',
                        3,
                        'hours',
                    ])
                    expect(result.toLocaleString('en-US', schedule)).toBe(
                        targetDate.toLocaleString('en-US', schedule),
                    )
                })
                it('sets for 1 day, 2 hours and 34 minutes', () => {
                    const targetDate = new Date('2024-09-17T11:34:00+01:00')
                    const result = createScheduleQuery(schedule).nextValidDate([
                        1,
                        'days',
                        2,
                        'hours',
                        34,
                        'minutes',
                    ])
                    expect(result.toLocaleString('en-US', schedule)).toBe(
                        targetDate.toLocaleString('en-US', schedule),
                    )
                })
                it('works with floats', () => {
                    const targetDate = new Date('2024-09-18T23:42:30+01:00')
                    const result = createScheduleQuery(schedule).nextValidDate([
                        2.5,
                        'days',
                        2.5,
                        'hours',
                        12.5,
                        'minutes',
                    ])
                    expect(result.toLocaleString('en-US', schedule)).toBe(
                        targetDate.toLocaleString('en-US', schedule),
                    )
                })
                it('fails on negative delay', () => {
                    expect(() =>
                        createScheduleQuery(schedule).nextValidDate([-2, 'days', -3, 'hours']),
                    ).toThrow('Negative delay')
                })
            })

            describe('working hours', () => {
                beforeEach(() => {
                    vi.useFakeTimers({
                        now: new Date('2024-09-16T09:00:00+01:00'),
                    })
                })
                const schedule: Schedule = {
                    timeZone: 'Europe/London',
                    workingHours: [
                        {
                            days: [
                                'monday',
                                'tuesday',
                                'wednesday',
                                'thursday',
                                'friday',
                                'saturday',
                                'sunday',
                            ],
                            from: '09:00',
                            to: '18:00',
                        },
                    ],
                }
                describe('when hit working hours slot', () => {
                    it('schedules in that slot', () => {
                        const targetDate = new Date('2024-09-16T15:00:00+01:00')
                        const result = createScheduleQuery(schedule).nextValidDate([6, 'hours'])
                        expect(result.toLocaleString('en-US', schedule)).toBe(
                            targetDate.toLocaleString('en-US', schedule),
                        )
                    })
                })
                describe('when miss working hours slot', () => {
                    it('schedules in next working hours slot', () => {
                        const targetDate = new Date('2024-09-17T09:00:00+01:00')
                        const result = createScheduleQuery(schedule).nextValidDate([12, 'hours'])
                        expect(result.toLocaleString('en-US', schedule)).toBe(
                            targetDate.toLocaleString('en-US', schedule),
                        )
                    })
                })
                describe('failure cases', () => {
                    const schedule: Schedule = {
                        timeZone: 'Europe/London',
                    }
                    it('fails when "from" is later then "to"', () => {
                        const query = createScheduleQuery({
                            ...schedule,
                            workingHours: [
                                {
                                    days: [
                                        'monday',
                                        'tuesday',
                                        'wednesday',
                                        'thursday',
                                        'friday',
                                        'saturday',
                                        'sunday',
                                    ],
                                    from: '21:00',
                                    to: '18:00',
                                },
                            ],
                        })

                        expect(() => query.nextValidDate([1, 'days'])).toThrow(
                            '"from" is later then "to"',
                        )
                    })
                })
            })

            describe('working days', () => {
                const schedule: Schedule = {
                    timeZone: 'Europe/London',
                    workingHours: [
                        {
                            days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
                            from: '09:00',
                            to: '18:00',
                        },
                    ],
                }
                beforeEach(() => {
                    vi.useFakeTimers({
                        now: new Date('2024-09-16T09:00:00+01:00'),
                    })
                })
                it('schedules on monday when hit on weekend', () => {
                    const targetDate = new Date('2024-09-23T09:00:00+01:00')
                    const result = createScheduleQuery(schedule).nextValidDate([6, 'days'])
                    expect(result.toLocaleString('en-US', schedule)).toBe(
                        targetDate.toLocaleString('en-US', schedule),
                    )
                })
                it('schedules on monday when hit on friday evening', () => {
                    const targetDate = new Date('2024-09-23T09:00:00+01:00')
                    const result = createScheduleQuery(schedule).nextValidDate([
                        4,
                        'days',
                        12,
                        'hours',
                    ])
                    expect(result.toLocaleString('en-US', schedule)).toBe(
                        targetDate.toLocaleString('en-US', schedule),
                    )
                })
            })
            describe('working days with intervals', () => {
                const schedule: Schedule = {
                    timeZone: 'Europe/London',
                    workingHours: [
                        {
                            days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
                            from: '09:00',
                            to: '18:00',
                        },
                        {
                            days: ['saturday', 'sunday'],
                            from: '10:00',
                            to: '17:00',
                        },
                    ],
                }
                beforeEach(() => {
                    vi.useFakeTimers({
                        now: new Date('2024-09-16T09:00:00+01:00'),
                    })
                })
                it('schedules on sunday 10:00  when hit on sunday 9:00', () => {
                    const targetDate = new Date('2024-09-22T10:00:00+01:00')
                    const result = createScheduleQuery(schedule).nextValidDate([6, 'days'])
                    expect(result.toLocaleString('en-US', schedule)).toBe(
                        targetDate.toLocaleString('en-US', schedule),
                    )
                })
                it('schedules on saturday 10:00 when hit on friday evening', () => {
                    const targetDate = new Date('2024-09-21T10:00:00+01:00')
                    const result = createScheduleQuery(schedule).nextValidDate([
                        4,
                        'days',
                        12,
                        'hours',
                    ])
                    expect(result.toLocaleString('en-US', schedule)).toBe(
                        targetDate.toLocaleString('en-US', schedule),
                    )
                })
            })
            describe('holidays', () => {
                beforeEach(() => {
                    vi.useFakeTimers({
                        now: new Date('2024-09-16T09:00:00+01:00'),
                    })
                })
                const schedule: Schedule = {
                    timeZone: 'Europe/London',
                    workingHours: [
                        {
                            days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
                            from: '09:00',
                            to: '18:00',
                        },
                    ],
                    holidays: ['2024-09-17', '2024-09-18'],
                }
                it('schedules on next working day when hit on holiday', () => {
                    const targetDate = new Date('2024-09-19T09:00:00+01:00')
                    const result = createScheduleQuery(schedule).nextValidDate([
                        2,
                        'days',
                        4,
                        'hours',
                    ])
                    expect(result.toLocaleString('en-US', schedule)).toBe(
                        targetDate.toLocaleString('en-US', schedule),
                    )
                })
                it('schedules on next working when hit on evening before holiday', () => {
                    const targetDate = new Date('2024-09-19T09:00:00+01:00')
                    const result = createScheduleQuery(schedule).nextValidDate([12, 'hours'])
                    expect(result.toLocaleString('en-US', schedule)).toBe(
                        targetDate.toLocaleString('en-US', schedule),
                    )
                })
            })

            describe('work with timezones', () => {
                describe('Paris timezone', () => {
                    const schedule: Schedule = {
                        timeZone: 'Europe/Paris',
                    }
                    beforeEach(() => {
                        vi.useFakeTimers({
                            now: new Date('2024-09-16T09:00:00+01:00'),
                        })
                    })
                    it('returns date in target timezone', () => {
                        const targetDate = new Date('2024-09-17T11:00:00+02:00')
                        const result = createScheduleQuery(schedule).nextValidDate([
                            1,
                            'days',
                            1,
                            'hours',
                        ])
                        expect(result.toLocaleString('en-US', schedule)).toBe(
                            targetDate.toLocaleString('en-US', schedule),
                        )
                    })
                    it('schedule same time next day when fall back time change', () => {
                        const currentDate = new Date('2024-10-26T18:00:00+02:00')
                        vi.setSystemTime(currentDate)
                        const targetDate = new Date('2024-10-27T18:00:00+01:00') // Paris winter time
                        const result = createScheduleQuery(schedule).nextValidDate([1, 'days'])
                        expect(result.toLocaleString('en-US', schedule)).toBe(
                            targetDate.toLocaleString('en-US', schedule),
                        )
                    })
                    it('schedule same time next day when spring forward time change', () => {
                        const currentDate = new Date('2024-03-30T18:00:00+01:00')
                        vi.setSystemTime(currentDate)
                        const targetDate = new Date('2024-03-31T18:00:00+02:00') // Paris summer time
                        const result = createScheduleQuery(schedule).nextValidDate([1, 'days'])
                        expect(result.toLocaleString('en-US', schedule)).toBe(
                            targetDate.toLocaleString('en-US', schedule),
                        )
                    })
                    it('schedules next monday morning when fall back time change with weekend', () => {
                        const currentDate = new Date('2024-10-25T20:00:00+02:00')
                        vi.setSystemTime(currentDate)
                        const targetDate = new Date('2024-10-29T09:00:00+01:00') // Paris winter time
                        const query = createScheduleQuery({
                            ...schedule,
                            workingHours: [
                                {
                                    days: ['tuesday', 'wednesday', 'thursday', 'friday'],
                                    from: '09:00',
                                    to: '18:00',
                                },
                            ],
                        })
                        const result = query.nextValidDate([1, 'hours'])
                        expect(result.toLocaleString('en-US', schedule)).toBe(
                            targetDate.toLocaleString('en-US', schedule),
                        )
                    })
                })
            })
        })
        describe('with date', () => {
            describe('basic date scheduling', () => {
                beforeEach(() => {
                    vi.useFakeTimers({
                        now: new Date('2024-09-16T09:00:00+01:00'),
                    })
                })
                const schedule: Schedule = {
                    timeZone: 'Europe/London',
                }
                it('schedules exact date when no constraints', () => {
                    const targetDate = new Date('2024-09-16T11:00:00+01:00')
                    const result = createScheduleQuery(schedule).nextValidDate(targetDate)
                    expect(result.toLocaleString('en-US', schedule)).toBe(
                        targetDate.toLocaleString('en-US', schedule),
                    )
                })
                it('schedules date in the future', () => {
                    const targetDate = new Date('2024-09-19T09:00:00+01:00')
                    const result = createScheduleQuery(schedule).nextValidDate(targetDate)
                    expect(result.toLocaleString('en-US', schedule)).toBe(
                        targetDate.toLocaleString('en-US', schedule),
                    )
                })
            })

            describe('working hours', () => {
                beforeEach(() => {
                    vi.useFakeTimers({
                        now: new Date('2024-09-16T09:00:00+01:00'),
                    })
                })
                const schedule: Schedule = {
                    timeZone: 'Europe/London',
                    workingHours: [
                        {
                            days: [
                                'monday',
                                'tuesday',
                                'wednesday',
                                'thursday',
                                'friday',
                                'saturday',
                                'sunday',
                            ],
                            from: '09:00',
                            to: '18:00',
                        },
                    ],
                }
                describe('when hit working hours slot', () => {
                    it('schedules in that slot', () => {
                        const targetDate = new Date('2024-09-16T15:00:00+01:00')
                        const result = createScheduleQuery(schedule).nextValidDate(targetDate)
                        expect(result.toLocaleString('en-US', schedule)).toBe(
                            targetDate.toLocaleString('en-US', schedule),
                        )
                    })
                })
                describe('when miss working hours slot', () => {
                    it('schedules in next working hours slot', () => {
                        const targetDate = new Date('2024-09-16T19:00:00+01:00')
                        const result = createScheduleQuery(schedule).nextValidDate(targetDate)
                        expect(result.toLocaleString('en-US', schedule)).toBe(
                            new Date('2024-09-17T09:00:00+01:00').toLocaleString('en-US', schedule),
                        )
                    })
                })
            })

            describe('working days', () => {
                const schedule: Schedule = {
                    timeZone: 'Europe/London',
                    workingHours: [
                        {
                            days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
                            from: '09:00',
                            to: '18:00',
                        },
                    ],
                }
                beforeEach(() => {
                    vi.useFakeTimers({
                        now: new Date('2024-09-16T09:00:00+01:00'),
                    })
                })
                it('schedules on monday when date falls on weekend', () => {
                    const result = createScheduleQuery(schedule).nextValidDate(
                        new Date('2024-09-22T12:00:00+01:00'),
                    )
                    expect(result.toLocaleString('en-US', schedule)).toBe(
                        new Date('2024-09-23T09:00:00+01:00').toLocaleString('en-US', schedule),
                    )
                })
                it('schedules on monday when date falls on friday evening', () => {
                    const result = createScheduleQuery(schedule).nextValidDate(
                        new Date('2024-09-20T20:00:00+01:00'),
                    )
                    expect(result.toLocaleString('en-US', schedule)).toBe(
                        new Date('2024-09-23T09:00:00+01:00').toLocaleString('en-US', schedule),
                    )
                })
            })

            describe('working days with intervals', () => {
                const schedule: Schedule = {
                    timeZone: 'Europe/London',
                    workingHours: [
                        {
                            days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
                            from: '09:00',
                            to: '18:00',
                        },
                        {
                            days: ['saturday', 'sunday'],
                            from: '10:00',
                            to: '17:00',
                        },
                    ],
                }
                beforeEach(() => {
                    vi.useFakeTimers({
                        now: new Date('2024-09-16T09:00:00+01:00'),
                    })
                })
                it('schedules on sunday 10:00 when date falls on sunday 9:00', () => {
                    const result = createScheduleQuery(schedule).nextValidDate(
                        new Date('2024-09-22T09:00:00+01:00'),
                    )
                    expect(result.toLocaleString('en-US', schedule)).toBe(
                        new Date('2024-09-22T10:00:00+01:00').toLocaleString('en-US', schedule),
                    )
                })
                it('schedules on saturday 10:00 when date falls on friday evening', () => {
                    const result = createScheduleQuery(schedule).nextValidDate(
                        new Date('2024-09-20T21:00:00+01:00'),
                    )
                    expect(result.toLocaleString('en-US', schedule)).toBe(
                        new Date('2024-09-21T10:00:00+01:00').toLocaleString('en-US', schedule),
                    )
                })
            })

            describe('holidays', () => {
                beforeEach(() => {
                    vi.useFakeTimers({
                        now: new Date('2024-09-16T09:00:00+01:00'),
                    })
                })
                const schedule: Schedule = {
                    timeZone: 'Europe/London',
                    workingHours: [
                        {
                            days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
                            from: '09:00',
                            to: '18:00',
                        },
                    ],
                    holidays: ['2024-09-17', '2024-09-18'],
                }
                it('schedules on next working day when date falls on holiday', () => {
                    const result = createScheduleQuery(schedule).nextValidDate(
                        new Date('2024-09-17T16:00:00+01:00'),
                    )
                    expect(result.toLocaleString('en-US', schedule)).toBe(
                        new Date('2024-09-19T09:00:00+01:00').toLocaleString('en-US', schedule),
                    )
                })
                it('schedules on next working day when date falls on evening before holiday', () => {
                    const result = createScheduleQuery(schedule).nextValidDate(
                        new Date('2024-09-16T21:00:00+01:00'),
                    )
                    expect(result.toLocaleString('en-US', schedule)).toBe(
                        new Date('2024-09-19T09:00:00+01:00').toLocaleString('en-US', schedule),
                    )
                })
            })

            describe('work with timezones', () => {
                describe('Paris timezone', () => {
                    const schedule: Schedule = {
                        timeZone: 'Europe/Paris',
                    }
                    beforeEach(() => {
                        vi.useFakeTimers({
                            now: new Date('2024-09-16T09:00:00+01:00'),
                        })
                    })
                    it('returns date in target timezone', () => {
                        const targetDate = new Date('2024-09-17T11:00:00+02:00')
                        const result = createScheduleQuery(schedule).nextValidDate(targetDate)
                        expect(result.toLocaleString('en-US', schedule)).toBe(
                            targetDate.toLocaleString('en-US', schedule),
                        )
                    })
                    it('handles DST fall back time change', () => {
                        const currentDate = new Date('2024-10-26T18:00:00+02:00')
                        vi.setSystemTime(currentDate)
                        const inputDate = new Date('2024-10-26T20:00:00+02:00')
                        const expectedDate = new Date('2024-10-27T10:00:00+01:00') // Paris winter time
                        const query = createScheduleQuery({
                            ...schedule,
                            workingHours: [
                                {
                                    days: ['sunday'],
                                    from: '10:00',
                                    to: '18:00',
                                },
                            ],
                        })
                        const result = query.nextValidDate(inputDate)
                        expect(result.toLocaleString('en-US', schedule)).toBe(
                            expectedDate.toLocaleString('en-US', schedule),
                        )
                    })
                    it('handles DST spring forward time change', () => {
                        const currentDate = new Date('2024-03-30T18:00:00+01:00')
                        vi.setSystemTime(currentDate)
                        const inputDate = new Date('2024-03-30T20:00:00+01:00')
                        const expectedDate = new Date('2024-03-31T10:00:00+02:00') // Paris summer time
                        const query = createScheduleQuery({
                            ...schedule,
                            workingHours: [
                                {
                                    days: ['sunday'],
                                    from: '10:00',
                                    to: '18:00',
                                },
                            ],
                        })
                        const result = query.nextValidDate(inputDate)
                        expect(result.toLocaleString('en-US', schedule)).toBe(
                            expectedDate.toLocaleString('en-US', schedule),
                        )
                    })
                })
            })
        })
    })

    describe('.isValid', () => {
        const schedule: Schedule = {
            timeZone: 'Europe/London',
            workingHours: [
                {
                    days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
                    from: '09:00',
                    to: '18:00',
                },
            ],
            holidays: ['2024-09-17', '2024-09-18'],
        }
        beforeEach(() => {
            vi.useFakeTimers()
            vi.setSystemTime(new Date('2024-09-16T14:00:00+01:00'))
        })

        it('checks date within schedule', () => {
            const query = createScheduleQuery(schedule)
            expect(query.isValid(new Date('2024-09-16T14:00:00+01:00'))).toBe(true)
        })
        it('checks date outside schedule (evening)', () => {
            const query = createScheduleQuery(schedule)
            expect(query.isValid(new Date('2024-09-16T19:00:00+01:00'))).toBe(false)
        })
        it('checks date outside schedule (weekend)', () => {
            const query = createScheduleQuery(schedule)
            expect(query.isValid(new Date('2024-09-21T14:00:00+01:00'))).toBe(false)
        })
        it('checks date outside schedule (holidays)', () => {
            const query = createScheduleQuery(schedule)
            expect(query.isValid(new Date('2024-09-18T14:00:00+01:00'))).toBe(false)
        })
    })
})
