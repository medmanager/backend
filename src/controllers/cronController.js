import apn from "apn";
import firebase from "firebase-admin";
import mongoose from "mongoose";
import schedule from "node-schedule";
import path from "path";
import { DosageSchema } from "../models/Dosage";
import { MedicationSchema } from "../models/Medication";
import { OccurrenceGroupSchema, OccurrenceSchema } from "../models/Occurrence";
import { UserSchema } from "../models/User";

const User = mongoose.model("User", UserSchema);
const Medication = mongoose.model("Medication", MedicationSchema);
const Dosage = mongoose.model("Dosage", DosageSchema);
const Occurrence = mongoose.model("Occurrence", OccurrenceSchema);
const OccurrenceGroup = mongoose.model(
    "OccurrenceGroup",
    OccurrenceGroupSchema
);

/**
 * When a new medication is added, schedule new jobs for the week
 * and store array of occurrences
 * ASSUME OTHER MEDS HAVE ALREADY BEEN SCHEDULED
 */
export const scheduleMedication = async (medication, userId) => {
    let scheduledDays = getScheduledMedicationDays(medication);
    //DO NOT USE .forEach because it won't loop asynchronously
    for (let day of scheduledDays) {
        for (let dosageOccurrence of day) {
            //need to ensure only schedule occurrences for dosagesIds on medication
            for (let dose of dosageOccurrence.datesWTime) {
                let now = new Date();
                if (now.getTime() < dose.date.getTime()) {
                    //create occurrence
                    let occurrence = {
                        isTaken: false,
                        timeTaken: null,
                        scheduledDate: dose.date,
                        dosage: dose.dosageId,
                    };
                    //not sure if we can use findOneAndUpdate here
                    //since we need to be able to add occurrence to the queue
                    let uDose = await Dosage.findOne({ _id: dose.dosageId });
                    occurrence = new Occurrence(occurrence);
                    await occurrence.save();
                    uDose.occurrences.push(occurrence._id);
                    await uDose.save();
                }
            }
        }
    }
    await medication
        .populate({
            path: "dosages",
            model: "Dosage",
            populate: { path: "occurrences", model: "Occurrence" },
        })
        .execPopulate();
    //find all occurrenceGroups that belong to the user
    let occurrenceGroups = await OccurrenceGroup.find({ user: userId });
    let sortedOccurrences = sortOccurrencesByTimeMed(medication);
    let now = new Date();
    for (let dayIndex = 0; dayIndex < sortedOccurrences.length; dayIndex++) {
        //skip over previous days of the week
        if (dayIndex < now.getDay()) {
            continue;
        }
        let day = sortedOccurrences[dayIndex];
        //iterate over each day and group together occurrences that happen in the same minute
        for (let i = 0; i < day.length; i++) {
            //if scheduledDate has already passed don't do anything
            if (day[i].scheduledDate.getTime() < now.getTime()) continue;

            //CHECK IF THERE IS AN EXISTING OCCURRENCE GROUP AT THIS TIME
            let indexOfOccGroup = occurrenceGroups.findIndex(
                (occGroup) =>
                    occGroup.scheduledDate.getDay() ==
                        day[i].scheduledDate.getDay() &&
                    occGroup.scheduledDate.getHours() ==
                        day[i].scheduledDate.getHours() &&
                    occGroup.scheduledDate.getMinutes() ==
                        day[i].scheduledDate.getMinutes()
            );
            //if there is an existing group, merge new occurrences into group
            let occurrenceGroup;
            let oldGroup = false;
            if (indexOfOccGroup != -1) {
                oldGroup = true;
                occurrenceGroup = occurrenceGroups[indexOfOccGroup];
            } else {
                occurrenceGroup = new OccurrenceGroup();
            }
            let assembleGroup = [];
            assembleGroup.push(day[i]);
            await Occurrence.findOneAndUpdate(
                { _id: day[i]._id },
                { group: occurrenceGroup._id }
            );
            let occurrenceTime =
                day[i].scheduledDate.getHours() +
                day[i].scheduledDate.getMinutes();
            let j = i + 1;
            for (; j < day.length; j++) {
                let nOccurrenceTime =
                    day[j].scheduledDate.getHours() +
                    day[j].scheduledDate.getMinutes();
                if (occurrenceTime == nOccurrenceTime) {
                    assembleGroup.push(day[j]);
                    await Occurrence.findOneAndUpdate(
                        { _id: day[j]._id },
                        { group: occurrenceGroup._id }
                    );
                } else if (occurrenceTime < nOccurrenceTime) {
                    break;
                }
            }
            i = j - 1;
            occurrenceGroup.occurrences = occurrenceGroup.occurrences.concat(
                assembleGroup
            );
            occurrenceGroup.user = userId;
            //set scheduleDate equal to the first occurrence in assembleGroup
            //assembleGroup should always have at least one occurrence in it
            occurrenceGroup.scheduledDate = new Date(
                assembleGroup[0].scheduledDate.getTime()
            );
            //save occurrence group
            if (oldGroup) {
                //if we're using an existing group, just update with
                //the new number of occurrences
                await OccurrenceGroup.findOneAndUpdate(
                    { _id: occurrenceGroup._id },
                    { occurrences: occurrenceGroup.occurrences }
                );
            } else {
                await occurrenceGroup.save();
                //schedule job if it's a new group
                schedule.scheduleJob(
                    occurrenceGroup._id.toString(),
                    occurrenceGroup.scheduledDate,
                    function () {
                        sendNotification(occurrenceGroup._id, userId);
                    }
                );
            }
        }
    }
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
    await deleteOccurrenceGroups(user);
    let now = new Date();
    //check is the user has already been scheduled this week
    //if so, we don't want to add any more occurrences since they will be duplicates
    let lastSunday = new Date();
    lastSunday.setHours(0, 0, 0, 0);
    lastSunday = lastSunday.getTime() - lastSunday.getDay() * 1000 * 3600 * 24;
    if (user.lastScheduled.getTime() < lastSunday) {
        await user
            .populate({
                path: "medications",
                populate: { path: "dosages", model: "Dosage" },
            })
            .execPopulate();
        let occurrences = getScheduledDays(user);
        for (let day of occurrences) {
            for (let med of day) {
                //we found the right med
                for (let dose of med.datesWTime) {
                    //ensure that the occurrence hasn't already passed
                    if (now.getTime() < dose.date.getTime()) {
                        //create occurrence
                        let occurrence = {
                            isTaken: false,
                            timeTaken: null,
                            scheduledDate: dose.date,
                            dosage: dose.dosageId,
                        };
                        let uDose = await Dosage.findOne({
                            _id: dose.dosageId,
                        });
                        occurrence = new Occurrence(occurrence);
                        await occurrence.save();
                        uDose.occurrences.push(occurrence);
                        await uDose.save();
                    }
                }
            }
        }
    }
    await user
        .populate({
            path: "medications",
            model: "Medication",
            populate: {
                path: "dosages",
                model: "Dosage",
                populate: { path: "occurrences", model: "Occurrence" },
            },
        })
        .execPopulate();
    let sortedOccurrences = sortOccurrencesByTime(user);
    for (let dayIndex = 0; dayIndex < sortedOccurrences.length; dayIndex++) {
        //skip over previous days of the week
        if (dayIndex < now.getDay()) {
            continue;
        }
        let day = sortedOccurrences[dayIndex];
        //iterate over each day and group together occurrences that happen in the same minute
        for (let i = 0; i < day.length; i++) {
            //if scheduledDate has already passed don't do anything
            //if occurrence has already been taken don't schedule it
            if (
                day[i].scheduledDate.getTime() < now.getTime() ||
                day[i].isTaken
            )
                continue;
            let occurrenceGroup = new OccurrenceGroup();
            let assembleGroup = [];
            assembleGroup.push(day[i]);
            await Occurrence.findOneAndUpdate(
                { _id: day[i]._id },
                { group: occurrenceGroup._id }
            );
            let occurrenceTime =
                day[i].scheduledDate.getHours() +
                day[i].scheduledDate.getMinutes();
            let j = i + 1;
            for (; j < day.length; j++) {
                let nOccurrenceTime =
                    day[j].scheduledDate.getHours() +
                    day[j].scheduledDate.getMinutes();
                if (occurrenceTime == nOccurrenceTime && !day[j].isTaken) {
                    assembleGroup.push(day[j]);
                    await Occurrence.findOneAndUpdate(
                        { _id: day[j]._id },
                        { group: occurrenceGroup._id }
                    );
                } else if (occurrenceTime < nOccurrenceTime) {
                    break;
                }
            }
            i = j - 1;
            occurrenceGroup.occurrences = assembleGroup;
            occurrenceGroup.user = user;
            //set scheduleDate equal to the first occurrence in assembleGroup
            //assembleGroup should always have at least one occurrence in it
            occurrenceGroup.scheduledDate = new Date(
                assembleGroup[0].scheduledDate.getTime()
            ); //save occurrence group
            await occurrenceGroup.save();

            //schedule job
            schedule.scheduleJob(
                occurrenceGroup._id.toString(),
                occurrenceGroup.scheduledDate,
                function () {
                    sendNotification(occurrenceGroup._id, userId);
                }
            );
        }
    }
    User.findOneAndUpdate({ _id: user._id }, { lastScheduled: now });
};

/**
 * Helper function for scheduleWeeklyOccurrences that removes all occurrenceGroups
 * Right now, we'll remove all occurrenceGroups on every User since occurrenceGroups
 * are directly related to scheduled jobs.
 *
 * One case this doesn't handle: a job is scheduled on Saturday and an occurrenceGroup
 * is created for Saturday at 9pm. If the user forgets to take their medication and
 * the backend fires the emergency contact function on Sunday at 9am, the occurrenceGroup
 * would have been deleted when this function was called at 12am on Sunday for the user.
 *
 * Possible solutions:
 * Check if occurrenceGroup has an emergency contact job scheduled prior to deletion.
 * If occurrenceGroup contains the emergency contact job id, this can be used to
 * check whether the key exists in schedule.scheduledJobs
 */
const deleteOccurrenceGroups = async (user) => {
    let occurrenceGroups = await OccurrenceGroup.find({ user: user._id });
    occurrenceGroups.map((oG) => (oG = oG._id));
    await OccurrenceGroup.deleteMany(
        { _id: { $in: occurrenceGroups } },
        (err) => {
            if (err) {
                console.log("cannot delete occurrenceGroups");
            }
        }
    );
};

const Platform = {
    iOS: "ios",
    Android: "android",
};

/**
 * Relevant documentation:
 * - https://docs.expo.io/push-notifications/sending-notifications-custom/ - For information on sending push notifications in general
 * - https://github.com/node-apn/node-apn - For sending apple push notifications
 * - https://firebase.google.com/docs/cloud-messaging/send-message - For sending android push notifications
 * @param {String} occurrenceId Occurrence id
 * @param {String} userId User id
 */
const sendNotification = async (occurrenceGroupId, userId) => {
    let occurrenceGroup = await OccurrenceGroup.findById(
        occurrenceGroupId
    ).populate({
        path: "occurrences",
        model: "Occurrence",
        populate: {
            path: "dosage",
            model: "Dosage",
        },
    });
    let user = await User.findById(userId);
    //check that at least one of the occurrences belongs to a dosage that has sendReminder as true
    let sendNotification = false;
    for (let occurrence of occurrenceGroup.occurrences) {
        if (occurrence.dosage.sendReminder) {
            sendNotification = true;
            break;
        }
    }
    //if we shouldn't send notification, delete occurrenceGroup and return
    if (!sendNotification) {
        OccurrenceGroup.deleteOne({ _id: occurrenceGroup._id });
        return;
    }
    console.log(user.deviceInfo);
    if (user.deviceInfo.os === Platform.iOS) {
        //ios logic
        const APPLE_TEAM_ID = "984MGH966E"; // obtained from Apple developer account
        const APPLE_KEY_ID = "NZBL8SR7RJ"; // obtained from Apple developer account
        const options = {
            token: {
                key: path.resolve(
                    __dirname + "../../../MedManager_apns_key.p8" // obtained from Apple developer account
                ),
                keyId: APPLE_KEY_ID,
                teamId: APPLE_TEAM_ID,
            },
            production: false,
        };

        const apnProvider = new apn.Provider(options);
        const notification = new apn.Notification();

        notification.expiry = Math.floor(Date.now() / 1000) + 3600; // Expires 1 hour from now.
        notification.sound = "ping.aiff";
        notification.alert =
            "It's time to take your medications. Open the MedManager app to see more.";
        notification.payload = { occurrenceGroupId };
        notification.topic = "org.reactjs.native.example.MedManager";

        const deviceToken = user.deviceInfo.token;
        const deviceTokens = [deviceToken];
        const response = await apnProvider.send(notification, deviceTokens);
        if (response.sent.length) {
            console.log("Notification successfully sent");
        } else {
            console.log("Notification failed to send");
            for (const error of response.failed) {
                console.error(error);
            }
            console.log(options);
            console.log(medication);
        }
    } else {
        /* This is the configuration file that contains the server key and account
        credentials that will allow us to send out firebase notifications. It will be 
        ignored by git (for security) */
        let serviceAccount = require("../../med-manager-3-firebase-adminsdk.json");

        // initializes firebase using the account credentials and the account database URL
        // (only initializes if this is the first notification sent out after the server starts up)

        // we have to check if the firebase app is already initialized as well because
        // firebase does not like it when you try to initialize another app
        if (firebase.apps.length === 0) {
            firebase.initializeApp({
                credential: firebase.credential.cert(serviceAccount),
                databaseURL:
                    "https://med-manager-eb6c0-default-rtdb.firebaseio.com/",
            });
        }

        // device token in order for firebase to know where to send the notification
        let registrationToken = user.deviceInfo.token;

        // Notification payload that contains notification content and the id information that the front end needs
        // to process the notification
        let payload = {
            notification: {
                title: "It's medication time!",
                body:
                    "It's take to take your medication. Open the MedManager app to see more.",
            },
            data: {
                occurrenceGroupId: occurrenceGroup._id.toString(),
            },
        };

        // options for notification
        let options = {
            priority: "high",
            timeToLive: 60 * 60 * 24,
        };

        // officially sends the notification and prints out either a confirmation or an error
        firebase
            .messaging()
            .sendToDevice(registrationToken, payload, options)
            .then(function (response) {
                console.log("sent firebase message: ", response);
            })
            .catch(function (error) {
                console.log("Error sending message: ", error);
            });
    }

    //once notification has been sent, delete occurrenceGroup
    //OccurrenceGroup.deleteOne({ _id: occurrenceGroup._id });
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
                millisToAdd += dosage.reminderTime.getMinutes() * 1000 * 60;
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
                        millisToAdd +=
                            dosage.reminderTime.getMinutes() * 1000 * 60;
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
                    millisToAdd += dosage.reminderTime.getMinutes() * 1000 * 60;
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
                            millisToAdd +=
                                dosage.reminderTime.getMinutes() * 1000 * 60;
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

/**
 * Given a populated user (with medications, dosages, and occurrences)
 * @param user populated user
 * @return sortedOccurrences array of seven days with occurrences on each day
 */
const sortOccurrencesByTime = (user) => {
    //create weekly array starting on sunday and ending on sat
    let sortedOccurrences = [];
    for (let i = 0; i < 7; i++) {
        sortedOccurrences.push([]);
    }
    let now = new Date();
    user.medications.forEach((med) => {
        med.dosages.forEach((dosage) => {
            dosage.occurrences.forEach((occurrence) => {
                if (occurrence.scheduledDate.getTime() > now.getTime()) {
                    //push occurrences onto correct day array inside sortedOccurrences
                    sortedOccurrences[occurrence.scheduledDate.getDay()].push(
                        occurrence
                    );
                }
            });
        });
    });

    //sort the occurrences by time
    sortedOccurrences.forEach((day) => {
        day.sort(
            (a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime()
        );
    });
    return sortedOccurrences;
};

/**
 * Given a populated medication (with dosages and occurrences)
 * @param medication populated medication
 * @return sortedOccurrences array of seven days with occurrences on each day
 */
const sortOccurrencesByTimeMed = (medication) => {
    //create weekly array starting on sunday and ending on sat
    let sortedOccurrences = [];
    for (let i = 0; i < 7; i++) {
        sortedOccurrences.push([]);
    }
    let now = new Date();
    medication.dosages.forEach((dosage) => {
        dosage.occurrences.forEach((occurrence) => {
            if (occurrence.scheduledDate.getTime() > now.getTime()) {
                //push occurrences onto correct day array inside sortedOccurrences
                sortedOccurrences[occurrence.scheduledDate.getDay()].push(
                    occurrence
                );
            }
        });
    });

    //sort the occurrences by time
    sortedOccurrences.forEach((day) => {
        day.sort(
            (a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime()
        );
    });
    return sortedOccurrences;
};
