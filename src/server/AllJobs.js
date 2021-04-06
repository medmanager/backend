import { isBefore, startOfWeek } from "date-fns";
import mongoose from "mongoose";
import schedule from "node-schedule";
import {
    getScheduledDays,
    scheduleWeeklyOccurrences,
    sendNotification,
    sortOccurrencesByTime,
} from "../controllers/cronController";
import { DosageSchema } from "../models/Dosage";
import { MedicationSchema } from "../models/Medication";
import { Metadata } from "../models/Metadata";
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

const scheduleUserJobs = async () => {
    let users = await User.find({});

    for (const user of users) {
        let time = "0 0 * * 0"; //run every week at the start of each Sunday
        //nodeschedule allows editing of jobs based off user id, so pass in user._id
        //kind of weird, but id must be a string
        schedule.scheduleJob(user._id.toString(), time, function () {
            scheduleWeeklyOccurrences(user._id);
        });

        //DEBUG PRINT STATEMENTS
        //console.log(user)
        // user.medications.forEach(med => {
        //     //console.log(med);
        //     med.dosages.forEach(dose => {
        //         //console.log(dose);
        //         dose.occurrences.forEach(occurrence => {
        //             console.log(occurrence);
        //         });
        //     });
        // });
    }
};

export const initServer = async () => {
    // check the lastScheduledAt value
    const metadata = await Metadata.findOne({
        name: "MedManager",
    });

    console.log({ metadata });

    let lastScheduledAt;
    if (metadata) {
        lastScheduledAt = metadata.lastScheduledAt;
    }

    const lastSunday = startOfWeek(new Date());
    console.log(lastSunday.toString());
    if (lastScheduledAt && isBefore(lastScheduledAt, lastSunday)) {
        console.log("this shouldn't happen");
        await initScheduleWeeklyOccurrences();
    }

    // delete past all the occurrence groups which are before the current time
    await OccurrenceGroup.deleteMany({
        scheduledDate: {
            $lte: new Date(),
        },
    });

    // query for all the occurrence groups in the db
    let groupsToSchedule = await OccurrenceGroup.find({});
    for (let group of groupsToSchedule) {
        //schedule job
        schedule.scheduleJob(
            group._id.toString(),
            group.scheduledDate,
            function () {
                sendNotification(group._id);
            }
        );
    }

    // update lastScheduledAt metadata
    await Metadata.findOneAndUpdate(
        { name: "MedManager" },
        { lastScheduledAt: new Date() },
        { upsert: true }
    );

    scheduleUserJobs();
};

/**
 * function to schedule weekly dosage occurrences at the start of the server
 */
const initScheduleWeeklyOccurrences = async () => {
    let users = await User.find({});

    let now = new Date();

    for (let user of users) {
        user = await user
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
        for (
            let dayIndex = 0;
            dayIndex < sortedOccurrences.length;
            dayIndex++
        ) {
            //skip over previous days of the week
            if (dayIndex < date.getDay()) {
                continue;
            }
            let day = sortedOccurrences[dayIndex];
            //iterate over each day and group together occurrences that happen in the same minute
            for (let i = 0; i < day.length; i++) {
                //if scheduledDate has already passed don't do anything
                //if occurrence has already been taken don't schedule it
                if (
                    day[i].scheduledDate.getTime() < date.getTime() ||
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
            }
        }
    }
};
