import {
    differenceInDays,
    endOfWeek,
    isAfter,
    isBefore,
    startOfWeek,
} from "date-fns";
import dayjs from "dayjs";
import later from "later";
import _ from "lodash";
import schedule from "node-schedule";
import Dosage from "../models/Dosage";
import Medication from "../models/Medication";
import Occurrence from "../models/Occurrence";
import OccurrenceGroup from "../models/OccurrenceGroup";
import User from "../models/User";
import { sendDosageNotification } from "./cron.controller";

later.date.localTime(); // use local time to generate occurrences

/**
 * Gets a single occurrence
 */
export const getOccurrenceFromID = async (req, res) => {
    const { occurrenceId } = req.params;
    const userId = req.user;
    if (userId == null) {
        return res
            .status(404)
            .json({ message: "token invalid: cannot get user" });
    }

    let occurrence;
    try {
        occurrence = await Occurrence.findById(occurrenceId);
        if (!occurrence) {
            return res.status(404).json({ message: "Occurrence not found" });
        }
    } catch (err) {
        return res.send(err);
    }

    await occurrence.populate("dosage").execPopulate();
    return res.status(200).json(occurrence);
};

/**
 * Function to get a users weekly medication occurrences
 */
export const getOccurrences = async (req, res) => {
    const userId = req.user;

    if (userId == null) {
        return res
            .status(400)
            .send({ message: "token invalid: cannot get user" });
    }

    let user;
    try {
        user = await User.findById(userId);
    } catch (err) {
        return res.status(404).json({ message: "User not found." });
    }

    if (!user) {
        return res.status(404).json({ message: "User not found." });
    }

    await user
        .populate({
            path: "medications",
            model: "Medication",
            populate: {
                path: "dosages",
                populate: {
                    path: "occurrences",
                    model: "Occurrence",
                },
                model: "Dosage",
            },
        })
        .execPopulate();

    const orderedDays = getWeeklyOccurrences(user);
    return res.status(200).json(orderedDays);
};

/*function to post when a medication is taken */
export const takeDosageOccurrence = async (req, res) => {
    const { occurrenceId } = req.params;
    let medication = null;
    let occurrence = null;
    try {
        occurrence = await Occurrence.findById(occurrenceId)
            .populate({
                path: "dosage",
                model: "Dosage",
                populate: { path: "medication", model: "Medication" },
            })
            .exec();

        if (!occurrence) {
            return res.status(404).json({
                message: "Error finding occurrence",
            });
        }

        if (!occurrence.dosage) {
            return res.state(404).json({
                message: "Error finding dosage",
            });
        }

        medication = occurrence.dosage.medication;
        if (!occurrence.dosage.medication) {
            return res.status(404).json({
                message: "Error finding medication",
            });
        }

        if (!medication.user.equals(req.user)) {
            return res.status(401).json({
                message: "You are not authorized to edit this occurrence",
            });
        }
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            message:
                "Error finding dosage and medication that correspond with the occurrence",
        });
    }

    //update occurrence
    Occurrence.findOneAndUpdate(
        { _id: occurrenceId },
        {
            isTaken: true,
            timeTaken: new Date(),
        },
        { new: true },
        async (err, occurrenceToUpdate) => {
            if (err) {
                return res
                    .status(404)
                    .json({ message: "cannot update occurrence!" });
            } else if (!occurrenceToUpdate) {
                return res
                    .status(404)
                    .json({ message: "Occurrence not found" });
            } else {
                //CANCEL NOTIFICATION
                let occurrenceGroup = await OccurrenceGroup.findById(
                    occurrenceToUpdate.group
                );
                //if occurrenceGroup exists then decide to unschedule/delete
                if (occurrenceGroup.length != 0 && occurrenceGroup[0] != null) {
                    occurrenceGroup = occurrenceGroup[0];
                    if (occurrenceGroup.occurrences.length <= 1) {
                        const key = occurrenceGroup._id.toString();
                        //if job exists, then cancel it!
                        if (key in schedule.scheduledJobs) {
                            const job = schedule.scheduledJobs[key];
                            if (job != undefined) {
                                job.cancel();
                            }
                        }
                        OccurrenceGroup.deleteOne({
                            _id: occurrenceGroup._id,
                        });
                    } else {
                        //if there are multiple occurrences,
                        //remove index of posted occurrence
                        let indexOfOccToRemove = occurrenceGroup.occurrences.findIndex(
                            (occ) => occ.equals(occurrenceToUpdate._id)
                        );
                        if (indexOfOccToRemove != -1) {
                            occurrenceGroup.occurrences.splice(
                                indexOfOccToRemove,
                                1
                            );
                        }
                        occurrenceGroup.save();
                    }
                }

                // decrement the amount of capsules, tablets, etc. remaining
                await Medication.findByIdAndUpdate(medication._id, {
                    $inc: { amount: -1 },
                });
                return res.status(200).json(occurrenceToUpdate);
            }
        }
    );
};

/**
 * Gets a single occurrence group
 */
export const getOccurrenceGroupFromID = async (req, res) => {
    const { occurrenceGroupId } = req.params;
    const userId = req.user;
    if (userId == null) {
        return res
            .status(404)
            .json({ message: "token invalid: cannot get user" });
    }

    let occurrenceGroup;
    try {
        occurrenceGroup = await OccurrenceGroup.findById(occurrenceGroupId);
        if (!occurrenceGroup) {
            return res.status(404).json({ message: "Occurrence not found" });
        }
        if (occurrenceGroup.user != userId) {
            return res.status(401).json({
                message: "You are not authorized to get this occurrence group",
            });
        }
    } catch (err) {
        return res.send(err);
    }

    await occurrenceGroup
        .populate({
            path: "occurrences",
            model: "Occurrence",
            populate: {
                path: "dosage",
                model: "Dosage",
                populate: { path: "medication", model: "Medication" },
            },
        })
        .execPopulate();
    return res.status(200).json(occurrenceGroup);
};

/**
 * Gets the current weeks occurrences for a given medication. Ensure that the medication
 * document passed in has populated dosages.
 *
 * @param {*} medication Medication document or object
 * @param {*} startDate Start date to consider when getting the occurrences. Default value is the start of the current week.
 * @param {*} endDate End date to consider when getting the occurrences. Default value is the end of the current week.
 * @returns Occurrences list
 */
export const getMedicationOccurrences = (
    medication,
    startDate = startOfWeek(new Date()),
    endDate = endOfWeek(new Date())
) => {
    let occurrences = [];
    if (medication == null) return occurrences;

    const frequency = medication.frequency;
    let weekdays = frequency.weekdays;
    if ("_id" in weekdays) {
        delete weekdays._id;
    }

    // sort the frequency weekdays so that Sunday comes first and Saturday is last
    const weekdaySorter = {
        sunday: 0,
        monday: 1,
        tuesday: 2,
        wednesday: 3,
        thursday: 4,
        friday: 5,
        saturday: 6,
    };
    let tmpSortedWeekdays = []; // temporarly holds the ordered weekday objects
    for (const key of Object.keys(weekdaySorter)) {
        const value = weekdays[key];
        const index = weekdaySorter[key.toLowerCase()];
        tmpSortedWeekdays[index] = {
            key: key,
            value: value,
        };
    }
    const sortedWeekdays = {};
    tmpSortedWeekdays.forEach((obj) => {
        sortedWeekdays[obj.key] = obj.value;
    });

    // sorted weekdays should now have weekday keys sorted by the order of the week starting on Sunday

    const weekdayValues = Object.values(sortedWeekdays);
    const weekdayIndices = weekdayValues.flatMap((bool, index) =>
        typeof bool === "boolean" && bool ? index + 1 : []
    );

    if (!medication.dosages || !Array.isArray(medication.dosages)) {
        return occurrences;
    }

    for (const dosage of medication.dosages) {
        const dosageReminderTime = dayjs(dosage.reminderTime);
        const dosageTime = dosageReminderTime.format("HH:mm");

        let dosageRecurrence;

        // define the dosage recurrence generator
        if (frequency.intervalUnit === "days") {
            // we need a recurrence value that is daily (once, twice, etc.) based on the interval
            dosageRecurrence = later.parse
                .recur()
                .every(frequency.interval)
                .dayOfWeek()
                .on(dosageTime)
                .time();
        } else if (frequency.intervalUnit === "weeks") {
            // we need a recurrence value that is weekly (also accounts for bi-weekly and interval values > 1) based on
            // the interval AND is on the specified weekdays

            dosageRecurrence = later.parse
                .recur()
                .every(frequency.interval)
                .weekOfYear()
                .on(...weekdayIndices)
                .dayOfWeek()
                .on(dosageTime)
                .time();
        } else {
            console.log(
                `Got unexpected frequency interval unit: ${frequency.intervalUnit}.`
            );
            break;
        }

        const dosageSchedule = later.schedule(dosageRecurrence);
        const dosageOccurrences = dosageSchedule.next(-1, startDate, endDate);

        if (!dosageOccurrences) {
            return occurrences;
        }

        for (const occurrence of dosageOccurrences) {
            occurrences.push({
                dosageId: dosage._id,
                occurrence,
            });
        }
    }

    // sort occurrences so that they are ordered based on the time they will occur
    occurrences.sort((a, b) => a.occurrence.getTime() - b.occurrence.getTime());
    return occurrences;
};

/**
 * Given a medication, create and schedule it's occurrences for the current week.
 *
 * NOTE: Ensure medication document has dosages pre-populated.
 * @param {*} medication Medication document
 */
export const createAndScheduleMedicationDosageOccurrences = async (
    medication
) => {
    const user = medication.user;
    let occurrences = getMedicationOccurrences(medication);
    let occurrenceObjects = [];
    const now = new Date();

    for (const { occurrence, dosageId } of occurrences) {
        // ensure that the occurrence hasn't already passed
        if (isAfter(occurrence, now)) {
            // find dose object
            const dose = await Dosage.findById(dosageId);
            const existingOccurrence = await Occurrence.findOne({
                dosage: dosageId,
                scheduledDate: occurrence,
            });

            // ensure that duplicated occurrences are not created
            if (!existingOccurrence) {
                // create occurrence object
                let occurrenceObject = new Occurrence({
                    isTaken: false,
                    timeTaken: null,
                    scheduledDate: occurrence,
                    dosage: dosageId,
                });
                await occurrenceObject.save();
                dose.occurrences.push(occurrenceObject);
                await dose.save();
                occurrenceObjects.push(occurrenceObject);
            }
        }
    }

    const groupedOccurrences = _.groupBy(occurrenceObjects, (o) =>
        o.scheduledDate.getTime()
    );

    for (let [groupScheduledDateTime, occurrences] of Object.entries(
        groupedOccurrences
    )) {
        const groupScheduledDate = new Date(Number(groupScheduledDateTime));

        let occurrenceGroup = await OccurrenceGroup.findOne({
            scheduledDate: groupScheduledDate,
            user,
        }); // could be null

        if (occurrenceGroup) {
            // there is already a group with this exact time
            occurrenceGroup.occurrences = occurrenceGroup.occurrences.concat(
                occurrences
            );
            await occurrenceGroup.save();
        } else {
            // group is new, need to create and schedule it
            occurrenceGroup = new OccurrenceGroup();
            occurrenceGroup.occurrences = occurrences;
            occurrenceGroup.user = user;
            occurrenceGroup.scheduledDate = groupScheduledDate;
            await occurrenceGroup.save();

            schedule.scheduleJob(
                occurrenceGroup._id.toString(),
                occurrenceGroup.scheduledDate,
                () => {
                    sendDosageNotification(occurrenceGroup._id);
                }
            );
        }

        const occurrenceIds = occurrences.map((o) => o._id);
        await Occurrence.updateMany(
            { _id: { $in: occurrenceIds } },
            { group: occurrenceGroup._id }
        );
    }
};

/**
 * Helper function to create weekly dosage occurrences for all medications in the database.
 * This function should only be called once a week on Sunday at 0:00 (or after if the server was not running).
 * NOTE: It may take a while to run if the db has a lot of active medications.
 */
export const createAndScheduleWeeklyOccurrences = async () => {
    console.log(
        "Creating all the occurrences for the server for the current week..."
    );
    console.log(
        `Found ${await OccurrenceGroup.countDocuments().exec()} occurrence groups in the DB`
    );

    console.log("Deleting all the past occurrence groups...");
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

    let medications = await Medication.find({}).populate("dosages").exec();

    for (let medication of medications) {
        if (medication.active) {
            console.log(
                `Creating weekly occurrences for ${medication.name}...`
            );
            await createAndScheduleMedicationDosageOccurrences(medication);
            console.log(`Done creating occurrences for ${medication.name}`);
        }
    }
    console.log("Weekly occurrence creation done!");
};

/**
 * Helper function for getOccurrences that uses the occurrences already stored
 * in the database to send. Formats them into an array of days containing an array of
 * occurrences where each occurrence has a medicationId, dosageId, and occurrence (from Dosage model)
 *
 * @param {*} user User document or object
 */
export const getWeeklyOccurrences = (
    user,
    startDate = startOfWeek(new Date()),
    endDate = endOfWeek(new Date())
) => {
    let scheduledDays = [];
    let numberOfDays = differenceInDays(endDate, startDate); // will be a value between 0-7
    for (let x = 0; x <= numberOfDays; x++) {
        scheduledDays.push([]);
    }

    user.medications.forEach((med) => {
        med.dosages.forEach((dose) => {
            dose.occurrences.forEach((occurrence) => {
                // only add occurrence to day if the occurrence is in the timeframe and
                // between start and end date

                if (
                    isAfter(occurrence.scheduledDate, startDate) &&
                    isBefore(occurrence.scheduledDate, endDate)
                ) {
                    const day = occurrence.scheduledDate.getDay();
                    scheduledDays[day].push({
                        medicationId: med._id,
                        dosageId: dose._id,
                        occurrence: occurrence,
                    });
                }
            });
        });
    });

    // const today = new Date().getDay();
    // console.log(scheduledDays);

    // sort each day by date
    scheduledDays.forEach((day) => {
        day.sort(
            (a, b) =>
                a.occurrence.scheduledDate.getTime() -
                b.occurrence.scheduledDate.getTime()
        );
    });
    return scheduledDays;
};

/**
 * Given a medication, deschedule and delete all of its future occurrences
 * @param {*} medication Medication document
 */
export const descheduleAndDeleteFutureDosageOccurrences = async (
    medication
) => {
    const dosages = medication.dosages;
    const dosageIds = dosages.map((dosage) => dosage._id);

    for (let dosageId of dosageIds) {
        //first get the dosage and populate the occurrences

        let dosage = await Dosage.findById(dosageId).populate("occurrences");
        if (dosage == null) continue;
        //we only want to remove occurrences that haven't happened yet
        //and haven't been taken yet
        let now = new Date();
        let occurrencesToRemove = dosage.occurrences.filter(
            (occ) => !occ.isTaken && occ.scheduledDate.getTime() > now.getTime()
        );

        let occurrenceGroupsToRemove = [];
        for (let occurrence of occurrencesToRemove) {
            if (occurrenceGroupsToRemove.indexOf(occurrence.group) == -1) {
                occurrenceGroupsToRemove.push(occurrence.group);
            }
        }

        occurrenceGroupsToRemove = await OccurrenceGroup.find({
            _id: { $in: occurrenceGroupsToRemove },
        }).populate("occurrences");

        //iterate over occurrenceGroups and delete groups that only have one occurrence
        for (let group of occurrenceGroupsToRemove) {
            if (group.occurrences.length == 1) {
                const key = group._id.toString();
                //if job exists, then cancel it!
                if (key in schedule.scheduledJobs) {
                    const job = schedule.scheduledJobs[key];
                    if (job != undefined) {
                        job.cancel();
                    }
                }
                await OccurrenceGroup.deleteOne({
                    _id: group._id,
                });
            } else {
                //TODO: FILTER OCCURRENCES TO BE REMOVED FROM GROUP AND DELETE GROUP IF NECESSARY
                for (let occurrence of occurrencesToRemove) {
                    let indexOfOccToRemove = group.occurrences.findIndex(
                        (occ) => occ.equals(occurrence._id)
                    );
                    if (indexOfOccToRemove != -1) {
                        group.occurrences.splice(indexOfOccToRemove, 1);
                    }
                }
                //if the occurrence group no longer has any meds just delete it
                //otherwise save the new group
                if (group.occurrences.length > 0) {
                    await group.save();
                } else {
                    await OccurrenceGroup.deleteOne({ _id: group._id });
                }
            }
        }

        await Occurrence.deleteMany(
            { _id: { $in: occurrencesToRemove } },
            (err) => {
                if (err) console.log("error deleting occurrences");
            }
        );
        //remove the deleted occurrences from the dosage
        // dosage.occurrences = dosage.occurrences.filter((occ) => {
        //     -1 != occurrencesToRemove.findIndex((occu) => occu._id == occ._id);
        // });

        await Dosage.updateOne({ _id: dosage._id }, dosage);
    }
};
