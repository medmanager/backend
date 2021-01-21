import { addNewMedication, getMedications, 
         getMedicationFromID, updateMedicationFromID, deleteMedicationFromID,
         getTimesFromMedicationID, getTimeFromTimeID} from '../controllers/controller'

const routes = (app) => {
    app.route('/medication')
        .post(addNewMedication)
        .get(getMedications);

    app.route('/medication/:medicationID')
        //get a specific medication from ID
        .get(getMedicationFromID)
        .put(updateMedicationFromID)
        .delete(deleteMedicationFromID);

    app.route('/medication/:medicationID/time')
        //get update times of a specific medication
        .get(getTimesFromMedicationID);
        //TODO
        //allow addition of a time

    app.route('/medication/time/:timeID')
        .get(getTimeFromTimeID);
        //TODO
        //changes to a time
        //deletion of a time
};

export default routes;