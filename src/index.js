import { isAfter, isBefore, startOfWeek } from "date-fns";
import _ from "lodash";
import mongoose from "mongoose";
import scheduler from "node-schedule";
import {
    getScheduledDays,
    sendNotification,
} from "./controllers/cronController";
import { DosageSchema } from "./models/Dosage";
import { MedicationSchema } from "./models/Medication";
import { Metadata } from "./models/Metadata";
import { OccurrenceGroupSchema, OccurrenceSchema } from "./models/Occurrence";
import { UserSchema } from "./models/User";

const User = mongoose.model("User", UserSchema);
const Medication = mongoose.model("Medication", MedicationSchema);
const Dosage = mongoose.model("Dosage", DosageSchema);
const Occurrence = mongoose.model("Occurrence", OccurrenceSchema);
const OccurrenceGroup = mongoose.model(
    "OccurrenceGroup",
    OccurrenceGroupSchema
);

const DEBUG_CREATE_WEEKLY_OCCURRENCES = false;

export const initServer = async () => {
    // check the lastScheduledAt value
    const serverMetadata = await Metadata.findOne({
        name: "MedManager",
    });

    let lastScheduledAt;
    if (serverMetadata) {
        lastScheduledAt = serverMetadata.lastScheduledAt;
    }

    const lastSunday = startOfWeek(new Date());

    // the statement below should only be true if we were to start the server after 0:00 on Sunday
    // in this scenario, the server did not have a chance to create the weeks occurrences becuase
    // the job was never fired, so we need to call the function manually here instead
    if (
        DEBUG_CREATE_WEEKLY_OCCURRENCES ||
        (lastScheduledAt && isBefore(lastScheduledAt, lastSunday))
    ) {
        console.log(
            "This should only happen if the server is started on Sunday after 0:00 or if the debug flag has been set"
        );
        await createWeeklyOccurrences();
        await scheduleOccurrenceGroups();
    } else {
        console.log("Scheduling occurrence groups...");
        await scheduleOccurrenceGroups();
        console.log(
            `Scheduled ${Object.entries(scheduler.scheduledJobs).length} jobs!`
        );
    }

    console.log("Scheduling weekly server job...");
    let time = "0 0 * * 0"; // run every week at the start of each Sunday
    scheduler.scheduleJob(
        "serverCreateWeeklyOccurrences",
        time,
        createWeeklyOccurrences
    );
};

/**
 * Schedules all the occurrence groups in the db
 */
const scheduleOccurrenceGroups = async () => {
    let groupsToSchedule = await OccurrenceGroup.find({});
    for (let group of groupsToSchedule) {
        // schedule notification jobs for the week
        scheduler.scheduleJob(
            group._id.toString(),
            group.scheduledDate,
            async () => {
                await sendNotification(group._id);
            }
        );
    }
};

/**
 * Function to create weekly dosage occurrences for all users
 * This function should be called weekly on Sunday at 0:00 to ensure each
 */
const createWeeklyOccurrences = async () => {
    console.log(
        "Creating all the occurrences for the server for the current week..."
    );
    console.log(
        `Found ${await OccurrenceGroup.count().exec()} occurrence groups in the DB`
    );

    console.log("Deleting all the occurrence groups which never fired...");
    // delete past all the occurrence groups which are before the current time
    const deleteResult = await OccurrenceGroup.deleteMany({
        scheduledDate: {
            $lt: new Date(),
        },
    });
    if (deleteResult.ok) {
        console.log(
            `Deleted ${deleteResult.deletedCount} past occurrence groups`
        );
    }

    let users = await User.find({});
    let now = new Date();

    for (let user of users) {
        // populate all the data for the user
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

        let occurrences = getScheduledDays(user);
        let occurrenceObjects = [];

        for (let day of occurrences) {
            for (let med of day) {
                for (let dose of med.datesWTime) {
                    // ensure that the occurrence hasn't already passed
                    if (isAfter(dose.date, now)) {
                        // create occurrence object
                        let occurrence = {
                            isTaken: false,
                            timeTaken: null,
                            scheduledDate: dose.date,
                            dosage: dose.dosageId,
                        };
                        let doseObject = await Dosage.findById(dose.dosageId);
                        let occurrenceObject = new Occurrence(occurrence);
                        await occurrenceObject.save();
                        doseObject.occurrences.push(occurrenceObject);
                        await doseObject.save();
                        occurrenceObjects.push(occurrenceObject);
                    }
                }
            }
        }

        const groupedOccurrences = _.groupBy(occurrenceObjects, (o) =>
            o.scheduledDate.getTime()
        );

        for (let [groupScheduledDateTime, occurrences] of Object.entries(
            groupedOccurrences
        )) {
            // filter occurrences that have already been taken
            occurrences = occurrences.filter((o) => !o.isTaken);

            const occurrenceGroup = new OccurrenceGroup();
            occurrenceGroup.occurrences = occurrences;
            occurrenceGroup.user = user;
            occurrenceGroup.scheduledDate = new Date(
                Number(groupScheduledDateTime)
            );

            const occurrenceIds = occurrences.map((o) => o._id);
            await Occurrence.updateMany(
                { _id: { $in: occurrenceIds } },
                { group: occurrenceGroup._id }
            );
            await occurrenceGroup.save();
        }
    }

    await Metadata.findOneAndUpdate(
        { name: "MedManager" },
        { lastScheduledAt: now },
        { upsert: true }
    );
    console.log("Occurrence creation done!");
};
