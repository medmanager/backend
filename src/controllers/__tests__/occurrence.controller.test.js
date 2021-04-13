import { getMedicationOccurrences } from "../occurrence.controller";

test("correctly gets occurrences for a weekly medication on Friday", () => {
    const medication = {
        _id: "123",
        frequency: {
            _id: "123",
            interval: 1,
            intervalUnit: "weeks",
            weekdays: {
                sunday: false,
                monday: false,
                tuesday: false,
                wednesday: false,
                thursday: false,
                friday: true,
                saturday: false,
            },
        },
        dosages: [
            {
                _id: "asdasdasd",
                dose: 1,
                sendReminder: true,
                reminderTime: new Date("April 11, 21 21:00:00"), // Fridays at 9pm
            },
        ],
        dateAdded: new Date(),
    };

    const occurrences = getMedicationOccurrences(medication);
    expect(occurrences.length).toBe(1);
    const firstOccurrence = occurrences[0];
    expect(firstOccurrence.occurrence.getDay()).toBe(5);
    expect(firstOccurrence.occurrence.getHours()).toBe(21);
});

test("correctly gets occurrences for a weekly medication on Saturday", () => {
    const medication = {
        _id: "123",
        frequency: {
            _id: "123",
            interval: 1,
            intervalUnit: "weeks",
            weekdays: {
                sunday: false,
                monday: false,
                tuesday: false,
                wednesday: false,
                thursday: false,
                friday: false,
                saturday: true,
            },
        },
        dosages: [
            {
                _id: "asdasdasd",
                dose: 1,
                sendReminder: true,
                reminderTime: new Date("April 11, 21 21:00:00"), // Fridays at 9pm
            },
        ],
        dateAdded: new Date(),
    };

    const occurrences = getMedicationOccurrences(medication);
    expect(occurrences.length).toBe(1);
    const firstOccurrence = occurrences[0];
    expect(firstOccurrence.occurrence.getDay()).toBe(6); // occurs on Friday
    expect(firstOccurrence.occurrence.getHours()).toBe(21); // happens at 9 PM
    expect(firstOccurrence.occurrence.getMinutes()).toBe(0);
});

test("correctly gets occurrences for a weekly medication with multiple days selected", () => {
    const medication = {
        _id: "123",
        frequency: {
            _id: "123",
            interval: 1,
            intervalUnit: "weeks",
            weekdays: {
                sunday: false,
                monday: true,
                tuesday: false,
                wednesday: false,
                thursday: false,
                friday: true,
                saturday: false,
            },
        },
        dosages: [
            {
                _id: "asdasdasd",
                dose: 1,
                sendReminder: true,
                reminderTime: new Date("April 11, 21 21:00:00"), // Fridays at 9pm
            },
        ],
        dateAdded: new Date(),
    };

    const occurrences = getMedicationOccurrences(medication);
    expect(occurrences.length).toBe(2);
    const [firstOccurrence, secondOccurrence] = occurrences;
    expect(firstOccurrence.occurrence.getDay()).toBe(1); // happens on Monday
    expect(firstOccurrence.occurrence.getHours()).toBe(21); // happens at 9 PM
    expect(secondOccurrence.occurrence.getDay()).toBe(5); // happens on Friday
    expect(secondOccurrence.occurrence.getHours()).toBe(21); // happens at 9 PM
});

test("correctly gets occurrences for a daily medication", () => {
    const medication = {
        _id: "123",
        frequency: {
            _id: "123",
            interval: 1,
            intervalUnit: "days",
            weekdays: {
                sunday: false,
                monday: false,
                tuesday: false,
                wednesday: false,
                thursday: false,
                friday: false,
                saturday: false,
            },
        },
        dosages: [
            {
                _id: "asdasdasd",
                dose: 1,
                sendReminder: true,
                reminderTime: new Date("April 11, 21 21:00:00"), // everyday at 9pm
            },
        ],
        dateAdded: new Date(),
    };

    const occurrences = getMedicationOccurrences(medication);
    expect(occurrences.length).toBe(7);
    const firstOccurrence = occurrences[0];
    expect(firstOccurrence.occurrence.getDay()).toBe(0);
    expect(firstOccurrence.occurrence.getHours()).toBe(21);
});

test("correctly gets occurrences for a daily medication with multiple dosages", () => {
    const medication = {
        _id: "123",
        frequency: {
            _id: "123",
            interval: 1,
            intervalUnit: "days",
            weekdays: {
                sunday: false,
                monday: false,
                tuesday: false,
                wednesday: false,
                thursday: false,
                friday: false,
                saturday: false,
            },
        },
        dosages: [
            {
                _id: "asdasdasd",
                dose: 1,
                sendReminder: true,
                reminderTime: new Date("April 11, 21 09:00:00"), // everyday at 9am
            },
            {
                _id: "asdasdkm",
                dose: 1,
                sendReminder: true,
                reminderTime: new Date("April 11, 21 21:00:00"), // everyday at 9pm
            },
        ],
        dateAdded: new Date(),
    };

    const occurrences = getMedicationOccurrences(medication);

    expect(occurrences.length).toBe(14);
    const [firstOccurrence, secondOccurrence] = occurrences;
    expect(firstOccurrence.occurrence.getHours()).toBe(9); // happens at 9 AM
    expect(firstOccurrence.occurrence.getDay()).toBe(0); // happens on Sunday
    expect(secondOccurrence.occurrence.getHours()).toBe(21); // happens at 9 PM
    expect(secondOccurrence.occurrence.getDay()).toBe(0); // happens on Sunday
});
