import bcrypt from "bcrypt";
import { createAndScheduleMedicationDosageOccurrences } from "./controllers/occurrence.controller";
import Dosage from "./models/Dosage";
import Medication from "./models/Medication";
import Occurrence from "./models/Occurrence";
import OccurrenceGroup from "./models/OccurrenceGroup";
import Settings from "./models/Settings";
import User from "./models/User";

let reminderTimeSevenPM = new Date("April 14, 21 19:00:00");
let reminderTimeNinePM = new Date("April 14, 21 21:00:00");

let dosage7PM = {
    dose: 1,
    sendReminder: true,
    reminderTime: reminderTimeSevenPM,
};

let dosage9PM = {
    dose: 1,
    sendReminder: true,
    reminderTime: reminderTimeNinePM,
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
    dosages: [],
    color: 0,
};

let farxiga = {
    name: "Farxiga",
    condition: "Heart Failure",
    strength: 10,
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
    dosages: [],
    color: 1,
};

let aspirin = {
    name: "Aspirin",
    condition: "Heart Disease",
    strength: 81,
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
    dosages: [],
    color: 2,
};

let alendronate = {
    name: "Alendronate",
    condition: "Osteoporsis",
    strength: 35,
    strengthUnit: "mg",
    amount: 120,
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
    dosages: [],
    color: 3,
};

const user = {
    firstName: "Tom",
    lastName: "Smith",
    email: "tomsmith@gmail.com",
    password: "123456",
};

export const seed = async (req, res) => {
    const { token, os } = req.body;

    await User.remove({});
    await Dosage.remove({});
    await Medication.remove({});
    await Occurrence.remove({});
    await OccurrenceGroup.remove({});

    const newUser = new User(user);
    const defaultSettings = new Settings();
    newUser.deviceInfo = {
        token,
        os,
    };
    newUser.hashPassword = bcrypt.hashSync(user.password, 10);
    newUser.settings = defaultSettings;

    const medOne = new Medication(spironolactone);
    const dosageOne = new Dosage(dosage9PM);
    await createOccurrences(dosageOne, 20);
    medOne.dosages.push(dosageOne);
    medOne.user = newUser._id;
    newUser.medications.push(medOne);
    await createAndScheduleMedicationDosageOccurrences(medOne);

    const medTwo = new Medication(farxiga);
    const dosageTwo = new Dosage(dosage9PM);
    await createOccurrences(dosageTwo, 30);
    medTwo.dosages.push(dosageTwo);
    medTwo.user = newUser._id;
    newUser.medications.push(medTwo);
    await createAndScheduleMedicationDosageOccurrences(medTwo);

    const medThree = new Medication(aspirin);
    const dosageThree = new Dosage(dosage9PM);
    await createOccurrences(dosageThree, 12);
    medThree.dosages.push(dosageThree);
    medThree.user = newUser._id;
    newUser.medications.push(medThree);
    await createAndScheduleMedicationDosageOccurrences(medThree);

    const medFour = new Medication(alendronate);
    const dosageFour = new Dosage(dosage7PM);
    await createOccurrences(dosageFour, 30);
    medFour.dosages.push(dosageFour);
    medFour.user = newUser._id;
    newUser.medications.push(medFour);
    await createAndScheduleMedicationDosageOccurrences(medFour);

    await Promise.all([
        medOne.save(),
        medTwo.save(),
        medThree.save(),
        medFour.save(),
        newUser.save(),
    ]);

    return res.status(200).json({ ok: true });
};

let timeTaken = new Date();
timeTaken = new Date(timeTaken.getTime() - 24 * 3600 * 1000 * 2);

const createOccurrences = async (dosage, trackingVal) => {
    for (let i = 0; i < 30; i++) {
        let occurrence = {
            isTaken: true,
            timeTaken: timeTaken,
            scheduledDate: timeTaken,
            dosage: dosage._id,
        };
        if (i > trackingVal) {
            occurrence.isTaken = false;
        }
        const newOccurrence = new Occurrence(occurrence);
        await newOccurrence.save();
        dosage.occurrences.push(newOccurrence);
    }
    await dosage.save();
};
