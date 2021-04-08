import { endOfWeek, isAfter, isBefore, startOfWeek } from "date-fns";
import schedule from "node-schedule";
import Dosage from "../models/Dosage";
import Medication from "../models/Medication";
import Occurrence from "../models/Occurrence";
import OccurrenceGroup from "../models/OccurrenceGroup";
import User from "../models/User";

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
 * Function to get weekly occurrences of all medications
 * 2 parameters in body:
 * @param startDate : DateTime object containing start date to find occurrences for
 * @param endDate : DateTime object marking the end date in the range of the occurrences
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
    if (req.user == null) {
        return res.status(400).json({
            message: "token error: cannot find user from token!",
        });
    }
    const { occurrenceId } = req.params;
    let occurrence = null;
    let medication = null;
    let dosage = null;
    try {
        occurrence = await Occurrence.findById(occurrenceId);

        if (!occurrence) {
            return res.status(404).json({
                message: "Error finding occurrence",
            });
        }

        //check that the occurrence belongs to the user posting it
        dosage = await Dosage.findById(occurrence.dosage);

        if (!dosage) {
            return res.state(404).json({
                message: "Error finding dosage",
            });
        }

        medication = await Medication.findById(dosage.medication);

        if (!medication) {
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
                let occurrenceGroup = await OccurrenceGroup.find({
                    _id: occurrenceToUpdate.group,
                });
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
 * Helper function for getOccurrences that uses the occurrences already stored
 * in the database to send. Formats them into an array of days containing an array of
 * occurrences where each occurrence has a medicationId, dosageId, and occurrence (from DosageModel)
 *
 * Right now the function is not dynamic and only gives occurrences for the current week
 *
 * When we start tracking occurrences from previous weeks, we can easily change the startDate
 * and endDate to parameters so that this function can be used to generate easily parsable
 * tracking data.
 */
export const getWeeklyOccurrences = (user) => {
    const date = new Date();
    const startDate = startOfWeek(date);
    const endDate = endOfWeek(date);

    //create entries in scheduledDays array for each day inbetween
    let scheduledDays = [];
    for (let x = 0; x < 7; x++) {
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

    console.log({ scheduledDays });

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
 * Given an array of dosageIds, deschedule all future occurrences that
 * correspond to the given dosageIds,
 */
export const descheduleAndDeleteFutureOccurrences = async (dosages) => {
    for (let dosageId of dosages) {
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
        dosage.occurrences = dosage.occurrences.filter((occ) => {
            -1 != occurrencesToRemove.findIndex((occu) => occu._id == occ._id);
        });

        await Dosage.updateOne({ _id: dosage._id }, dosage);
    }
};
