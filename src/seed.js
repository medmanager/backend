import bcrypt from "bcrypt";
import { createAndScheduleMedicationDosageOccurrences } from "./controllers/occurrence.controller";
import Dosage from "./models/Dosage";
import Medication from "./models/Medication";
import Occurrence from "./models/Occurrence";
import OccurrenceGroup from "./models/OccurrenceGroup";
import Settings from "./models/Settings";
import User from "./models/User";

let reminderTimeSevenPM = new Date();
reminderTimeSevenPM.setHours(19);
let reminderTimeNinePM = new Date();
reminderTimeNinePM.setHours(21);

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
    medOne.dosages.push(dosageOne._id);
    medOne.user = newUser._id;
    newUser.medications.push(medOne);

    const medTwo = new Medication(farxiga);
    const dosageTwo = new Dosage(dosage9PM);
    await createOccurrences(dosageTwo, 30);
    medTwo.dosages.push(dosageTwo._id);
    medTwo.user = newUser._id;
    newUser.medications.push(medTwo);

    const medThree = new Medication(aspirin);
    const dosageThree = new Dosage(dosage9PM);
    await createOccurrences(dosageThree, 15);
    medThree.dosages.push(dosageThree._id);
    medThree.user = newUser._id;
    newUser.medications.push(medThree);

    const medFour = new Medication(alendronate);
    const dosageFour = new Dosage(dosage7PM);
    await createOccurrences(dosageFour, 30);
    medFour.dosages.push(dosageFour._id);
    medFour.user = newUser._id;
    newUser.medications.push(medFour);

    await Promise.all([
        medOne.save(),
        medTwo.save(),
        medThree.save(),
        medFour.save(),
        newUser.save(),
    ]);
    await Promise.all([
        createAndScheduleMedicationDosageOccurrences(medOne),
        createAndScheduleMedicationDosageOccurrences(medTwo),
        createAndScheduleMedicationDosageOccurrences(medThree),
        createAndScheduleMedicationDosageOccurrences(medFour),
    ]);
};

let timeTaken = new Date();
timeTaken.setHours(0);

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
