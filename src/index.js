import { isBefore, startOfWeek } from "date-fns";
import scheduler from "node-schedule";
import { DEBUG_CREATE_WEEKLY_OCCURRENCES } from "./constants";
import {
    createAndScheduleWeeklyOccurrences,
    scheduleOccurrenceGroups,
} from "./controllers/occurrence.controller";
import Metadata from "./models/Metadata";

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
        await createAndScheduleWeeklyOccurrences();
        await Metadata.findOneAndUpdate(
            { name: "MedManager" },
            { lastScheduledAt: new Date() },
            { upsert: true }
        );
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
        createAndScheduleWeeklyOccurrences
    );
};
