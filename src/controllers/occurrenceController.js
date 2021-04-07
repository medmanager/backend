import { endOfWeek, isAfter, isBefore, startOfWeek } from "date-fns";

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
const getWeeklyOccurrences = (user) => {
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

export { getWeeklyOccurrences };
