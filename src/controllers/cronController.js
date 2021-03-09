import mongoose from "mongoose";
import schedule from "node-schedule";
import { DosageSchema, OccurrenceSchema } from "../models/Dosage";
import { MedicationSchema } from "../models/Medication";
import { UserSchema } from "../models/User";

const User = mongoose.model("User", UserSchema);
const Medication = mongoose.model("Medication", MedicationSchema);
const Dosage = mongoose.model("Dosage", DosageSchema);
const Occurrence = mongoose.model("Occurrence", OccurrenceSchema);

/**
 * When a new medication is added, schedule new jobs for the week
 * and store array of occurrences
 * ASSUME OTHER MEDS HAVE ALREADY BEEN SCHEDULED
 */
export const scheduleNewMedication = async (medication) => {
    let scheduledDays = getScheduledMedicationDays(medication);

    scheduledDays.forEach((day) => {
        day.forEach((dosageOccurrence) => {
            //need to ensure only schedule occurrences for dosagesIds on medication
            dosageOccurrence.datesWTime.forEach(async (dose) => {
                let now = new Date();
                if (now.getTime() < dose.date.getTime()) {
                    //create occurrence
                    let occurrence = {
                        isTaken: false,
                        isComplete: false,
                        timeTaken: null,
                        scheduledDate: dose.date,
                        dosage: dose._id,
                    };
                    //not sure if we can use findOneAndUpdate here
                    //since we need to be able to add occurrence to the queue
                    let uDose = await Dosage.findOne({ _id: dose.dosageId });
                    occurrence = new Occurrence(occurrence);
                    await occurrence.save();
                    uDose.occurrences.push(occurrence);
                    await uDose.save();
                }
            });
        });
    });
    medication.dosages.forEach(async (dosage) => {
        await dosage.populate("occurrences").execPopulate();
        dosage.occurrences.forEach((occurrence) => {
            //only schedule a job for the dose if reminders are toggled
            if (dosage.sendReminder) {
                schedule.scheduleJob(
                    occurrence._id.toString(),
                    occurrence.scheduledDate,
                    function () {
                        sendNotification();
                    }
                );
            }
        });
    });
};

/**
 * function to schedule weekly dosage occurrences for the week
 * Must create an occurrence entry array for each dosage
 */
export const scheduleWeeklyOccurrences = async (userId) => {
    let user = await User.findById(userId, (err) => {
        if (err) {
            console.log("cannot find user!");
            return;
        }
    });
    await user
        .populate({
            path: "medications",
            populate: { path: "dosages", model: "Dosage" },
        })
        .execPopulate();
    removeFutureOccurrences(user);
    let occurrences = getScheduledDays(user);
    occurrences.forEach((day) => {
        day.forEach((med) => {
            //we found the right med
            med.datesWTime.forEach(async (dose) => {
                //ensure that the occurrence hasn't already passed
                let now = new Date();
                if (now.getTime() < dose.date.getTime()) {
                    //create occurrence
                    let occurrence = {
                        isTaken: false,
                        isComplete: false,
                        timeTaken: null,
                        scheduledDate: dose.date,
                        dosage: dose._id,
                    };
                    let uDose = await Dosage.findOne({ _id: dose.dosageId });
                    occurrence = new Occurrence(occurrence);
                    occurrence.save();
                    uDose.occurrences.push(occurrence);
                    uDose.save();
                }
            });
        });
    });
    //SAVING USER WILL AUTO GENERATE OCCURRENCE ID'S FOR US TO USE
    user.medications.forEach((med) => {
        med.dosages.forEach((dosage) => {
            dosage.occurrences.forEach((occurrence) => {
                //only schedule a job for the dose if reminders are toggled
                if (dosage.sendReminder) {
                    schedule.scheduleJob(
                        occurrence._id.toString(),
                        occurrence.scheduledDate,
                        function () {
                            sendNotification();
                        }
                    );
                }
            });
        });
    });
};

/**
 * Helper function for scheduleWeeklyOccurrences that removes
 * all future occurrences before scheduling the ones for this week.
 * This is to ensure we don't over populate the occurrences, since
 * we only want to schedule each future occurrence once.
 */
const removeFutureOccurrences = (user) => {
    user.medications.forEach((med) => {
        med.dosages.forEach((dosage) => {
            //first find all occurrences attached to dosage
            Occurrence.find(
                { _id: { $in: dosage.occurrences } },
                (err, occurrences) => {
                    if (err) {
                        console.log("cannot find occurrences");
                        return;
                    } else {
                        //get all occurrences that are scheduled to occur after
                        //the current date
                        let now = new Date();
                        let occurrencesToRemove = occurrences.filter(
                            (occurrence) =>
                                occurrence.scheduledDate.getTime() >
                                now.getTime()
                        );
                        //obtain an array of ids from the array of occurrence objects
                        let occurrenceIds = occurrencesToRemove.map(
                            (occ) => occ._id
                        );
                        //delete all future occurrences
                        Occurrence.deleteMany(
                            { _id: { $in: occurrenceIds } },
                            (err) => {
                                if (err) {
                                    console.log(
                                        "cannot delete future occurrences"
                                    );
                                    return;
                                }
                            }
                        );
                    }
                }
            );
        });
    });
};

export const sendNotification = () => {
    console.log("take your medication");
};

/**
 * returns an object with a start and end date
 * corresponding to this week
 */
const startAndEndDateDefault = () => {
    //set end date to next saturday
    let endDate = new Date();
    let day = endDate.getDay();
    //add remaining days in the week in millis
    endDate = new Date(endDate.getTime() + (6 - day) * 24 * 3600 * 1000);

    //set start date to last sunday (or today if today is sunday)
    let startDate = new Date();
    day = startDate.getDay();
    //sunday is index 0 so subtract current day in millis
    startDate = new Date(startDate.getTime() - day * 24 * 3600 * 1000);

    //ceil both startDate and endDate to the endOfDay (avoids indexing issues later)
    startDate = new Date(startDate.getTime());
    startDate.setHours(23, 59, 59, 999);
    endDate = new Date(endDate.getTime());
    endDate.setHours(23, 59, 59, 999);

    return { startDate: startDate, endDate: endDate };
};

/**
 * Returns weekly scheduled occurrences for one medication passed in
 * as a parameter. Ensure that the medication has populated dosages.
 */
const getScheduledMedicationDays = (med) => {
    let week = startAndEndDateDefault();
    let startDate = week.startDate;
    let endDate = week.endDate;

    let scheduledDays = [];

    //get number of milliseconds between start date and end date
    let days = endDate.getTime() - startDate.getTime();
    //divide by number of milliseconds in one day and ceil
    days = Math.ceil(days / (1000 * 3600 * 24));
    //create entries in scheduledDays array for each day inbetween
    for (let x = 0; x <= days; x++) {
        scheduledDays.push([]);
    }
    if (med == null) return scheduledDays;
    let start = med.dateAdded;
    //get number of milliseconds between start date and end date
    let daysbetween = endDate.getTime() - start.getTime();
    //divide by number of milliseconds in one day and ceil
    daysbetween = Math.ceil(daysbetween / (1000 * 3600 * 24));
    //start may not be startDate so create an offset
    let offset = 0;
    offset = startDate.getTime() - start.getTime();
    offset = Math.floor(offset / (1000 * 3600 * 24));
    //loop over days from start and only include them if they are after startDate
    if (med.frequency.intervalUnit == "days") {
        for (let i = 0; i < daysbetween; i += med.frequency.interval) {
            if (daysbetween - i > days + 1) {
                //day is before start so just continue looping
                continue;
            }
            let daysbetween_m = i * (1000 * 3600 * 24);
            //find actual date to take medication
            let dateToTake = new Date(start.getTime() + daysbetween_m);
            //round down to 12 am
            dateToTake.setHours(0, 0, 0, 0);
            let datesWTime = [];
            med.dosages.forEach((dosage) => {
                //get amount of millis to add to current dateToTake
                let millisToAdd = dosage.reminderTime.getHours() * 3600 * 1000;
                let dateWTime = new Date(dateToTake.getTime() + millisToAdd);
                datesWTime.push({ date: dateWTime, dosageId: dosage._id });
            });
            if (datesWTime.length > 0) {
                scheduledDays[i - offset].push({
                    datesWTime,
                    medicationId: med._id,
                });
            }
        }
    } else {
        //if the start of each week isn't Sunday, make it Sunday
        let days_s = start.getDay();
        if (days_s != 0) {
            start = new Date(start.getTime() - days_s * (1000 * 3600 * 24));
        }

        //loop over weeks so multiply interval by 7
        for (let i = 0; i < daysbetween; i += 7 * med.frequency.interval) {
            if (daysbetween - i - 6 > days + 1) {
                //day is before start so continue looping
                continue;
            }
            //loop over each day of this week
            for (let j = i; j < i + 7; j++) {
                let daysbetween_m = (j - i) * (1000 * 3600 * 24);
                let dateToTake = new Date(start.getTime() + daysbetween_m);
                dateToTake.setHours(23, 59, 59, 999);

                //we need to check if the weekday matches the current day
                //and the current weekday is set to true in the database for this med
                //we also need to make sure the date is in the day range too
                if (
                    (med.frequency.weekdays.sunday &&
                        dateToTake.getDay() == 0) ||
                    (med.frequency.weekdays.monday &&
                        dateToTake.getDay() == 1) ||
                    (med.frequency.weekdays.tuesday &&
                        dateToTake.getDay() == 2) ||
                    (med.frequency.weekdays.wednesday &&
                        dateToTake.getDay() == 3) ||
                    (med.frequency.weekdays.thursday &&
                        dateToTake.getDay() == 4) ||
                    (med.frequency.weekdays.friday &&
                        dateToTake.getDay() == 5) ||
                    (med.frequency.weekdays.saturday &&
                        dateToTake.getDay() == 6 &&
                        daysbetween - j <= days)
                ) {
                    dateToTake.setHours(0, 0, 0, 0);
                    let datesWTime = [];
                    med.dosages.forEach((dosage) => {
                        //get amount of millis to add to current dateToTake
                        let millisToAdd =
                            dosage.reminderTime.getHours() * 3600 * 1000;
                        let dateWTime = new Date(
                            dateToTake.getTime() + millisToAdd
                        );
                        datesWTime.push({
                            date: dateWTime,
                            dosageId: dosage._id,
                        });
                    });
                    if (datesWTime.length > 0) {
                        scheduledDays[j - i].push({
                            datesWTime,
                            medicationId: med._id,
                        });
                    }
                }
            }
        }
    }
    //eaving prints for testing purposes
    // let i = 0;
    // scheduledDays.forEach(day => {
    //     console.log("day: " + i);
    //     day.forEach(date => {
    //         console.log(date.medicationId);
    //         date.datesWTime.forEach(dateWTime => {
    //             console.log(dateWTime.date.toString());
    //             console.log(dateWTime.dosageId);
    //         });
    //     });
    //     i++;
    // });
    return scheduledDays;
};

/*
 * Function returns an array of days indexed from 0 (startDay) to (endDay - 1)
 * Inside each array, there are arrays of all the medications that are scheduled to be
 * taken that day. Inside the each medication object within the array, there is an array
 * that has the specific DateTime the medication needs to be taken. It also has the
 * dosageId.
 */
const getScheduledDays = (user) => {
    let week = startAndEndDateDefault();
    let startDate = week.startDate;
    let endDate = week.endDate;
    let scheduledDays = [];

    //get number of milliseconds between start date and end date
    let days = endDate.getTime() - startDate.getTime();
    //divide by number of milliseconds in one day and ceil
    days = Math.ceil(days / (1000 * 3600 * 24));
    //create entries in scheduledDays array for each day inbetween
    for (let x = 0; x <= days; x++) {
        scheduledDays.push([]);
    }
    if (user.medications == null) return scheduledDays;
    user.medications.forEach((med) => {
        let start = med.dateAdded;
        //get number of milliseconds between start date and end date
        let daysbetween = endDate.getTime() - start.getTime();
        //divide by number of milliseconds in one day and ceil
        daysbetween = Math.ceil(daysbetween / (1000 * 3600 * 24));
        //start may not be startDate so create an offset
        let offset = 0;
        offset = startDate.getTime() - start.getTime();
        offset = Math.floor(offset / (1000 * 3600 * 24));
        //loop over days from start and only include them if they are after startDate
        if (med.frequency.intervalUnit == "days") {
            for (let i = 0; i < daysbetween; i += med.frequency.interval) {
                if (daysbetween - i > days + 1) {
                    //day is before start so just continue looping
                    continue;
                }
                let daysbetween_m = i * (1000 * 3600 * 24);
                //find actual date to take medication
                let dateToTake = new Date(start.getTime() + daysbetween_m);
                //round down to 12 am
                dateToTake.setHours(0, 0, 0, 0);
                let datesWTime = [];
                med.dosages.forEach((dosage) => {
                    //get amount of millis to add to current dateToTake
                    let millisToAdd =
                        dosage.reminderTime.getHours() * 3600 * 1000;
                    let dateWTime = new Date(
                        dateToTake.getTime() + millisToAdd
                    );
                    datesWTime.push({ date: dateWTime, dosageId: dosage._id });
                });
                if (datesWTime.length > 0) {
                    scheduledDays[i - offset].push({
                        datesWTime,
                        medicationId: med._id,
                    });
                }
            }
        } else {
            //if the start of each week isn't Sunday, make it Sunday
            let days_s = start.getDay();
            if (days_s != 0) {
                start = new Date(start.getTime() - days_s * (1000 * 3600 * 24));
            }

            //loop over weeks so multiply interval by 7
            for (let i = 0; i < daysbetween; i += 7 * med.frequency.interval) {
                if (daysbetween - i - 6 > days + 1) {
                    //day is before start so continue looping
                    continue;
                }
                //loop over each day of this week
                for (let j = i; j < i + 7; j++) {
                    let daysbetween_m = (j - i) * (1000 * 3600 * 24);
                    let dateToTake = new Date(start.getTime() + daysbetween_m);
                    dateToTake.setHours(23, 59, 59, 999);

                    //we need to check if the weekday matches the current day
                    //and the current weekday is set to true in the database for this med
                    //we also need to make sure the date is in the day range too
                    if (
                        (med.frequency.weekdays.sunday &&
                            dateToTake.getDay() == 0) ||
                        (med.frequency.weekdays.monday &&
                            dateToTake.getDay() == 1) ||
                        (med.frequency.weekdays.tuesday &&
                            dateToTake.getDay() == 2) ||
                        (med.frequency.weekdays.wednesday &&
                            dateToTake.getDay() == 3) ||
                        (med.frequency.weekdays.thursday &&
                            dateToTake.getDay() == 4) ||
                        (med.frequency.weekdays.friday &&
                            dateToTake.getDay() == 5) ||
                        (med.frequency.weekdays.saturday &&
                            dateToTake.getDay() == 6 &&
                            daysbetween - j <= days)
                    ) {
                        dateToTake.setHours(0, 0, 0, 0);
                        let datesWTime = [];
                        med.dosages.forEach((dosage) => {
                            //get amount of millis to add to current dateToTake
                            let millisToAdd =
                                dosage.reminderTime.getHours() * 3600 * 1000;
                            let dateWTime = new Date(
                                dateToTake.getTime() + millisToAdd
                            );
                            datesWTime.push({
                                date: dateWTime,
                                dosageId: dosage._id,
                            });
                        });
                        if (datesWTime.length > 0) {
                            scheduledDays[j - i].push({
                                datesWTime,
                                medicationId: med._id,
                            });
                        }
                    }
                }
            }
        }
    });
    //eaving prints for testing purposes
    // let i = 0;
    // scheduledDays.forEach(day => {
    //     console.log("day: " + i);
    //     day.forEach(date => {
    //         console.log(date.medicationId);
    //         date.datesWTime.forEach(dateWTime => {
    //             console.log(dateWTime.date.toString());
    //             console.log(dateWTime.dosageId);
    //         });
    //     });
    //     i++;
    // });
    return scheduledDays;
};
