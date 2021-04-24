import { diffDosages } from "../medication.controller";

let reminderTimeSixPM = new Date("April 14, 21 18:00:00");
let reminderTimeSevenPM = new Date("April 14, 21 19:00:00");
let reminderTimeEightPM = new Date("April 14, 21 20:00:00");
let reminderTimeNinePM = new Date("April 14, 21 21:00:00");

let dosage7PM = {
    _id: "1234",
    dose: 1,
    sendReminder: true,
    reminderTime: reminderTimeSevenPM,
};

let dosage9PM = {
    _id: "1235",
    dose: 1,
    sendReminder: true,
    reminderTime: reminderTimeNinePM,
};

let dosage8PM = {
    _id: "1236",
    dose: 1,
    sendReminder: true,
    reminderTime: reminderTimeEightPM,
};

let spironolactone = {
    name: "Spironolactone",
    condition: "Heart Failure",
    strength: 25,
    strengthUnit: "mg",
    amount: 90,
    amountUnit: "tablets",
    frequency: {
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
    dosages: [dosage7PM, dosage9PM],
    color: 0,
};

test("diff dosages returns a correct modified dosage", () => {
    const med = spironolactone;
    const newMed = JSON.parse(JSON.stringify(med));
    newMed.dosages[0].reminderTime = reminderTimeEightPM;

    const [modifiedDosages, unchangedDosages] = diffDosages(
        newMed.dosages,
        med.dosages
    );

    expect(modifiedDosages.length).toBe(1);
    expect(unchangedDosages.length).toBe(1);
    expect(modifiedDosages[0]._id).toBe("1234");
});

test("diff dosages returns a correct new dosage", () => {
    const med = spironolactone;
    const newMed = JSON.parse(JSON.stringify(med));
    newMed.dosages.push(dosage8PM);

    const [modifiedDosages, unchangedDosages] = diffDosages(
        newMed.dosages,
        med.dosages
    );

    console.log({ modifiedDosages, unchangedDosages });

    expect(modifiedDosages.length).toBe(1);
    expect(unchangedDosages.length).toBe(2);
    expect(modifiedDosages[0]._id).toBe("1236");
});

test("diff dosages returns a correct new dosage and modified dosage", () => {
    const med = spironolactone;
    const newMed = JSON.parse(JSON.stringify(med));
    newMed.dosages.push(dosage8PM);
    newMed.dosages[0].reminderTime = reminderTimeSixPM;

    const [modifiedDosages, unchangedDosages] = diffDosages(
        newMed.dosages,
        med.dosages
    );

    console.log({ modifiedDosages, unchangedDosages });

    expect(modifiedDosages.length).toBe(2);
    expect(unchangedDosages.length).toBe(1);
});
