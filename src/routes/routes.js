import { addNewMedication, getMedications, 
    getMedicationFromID, updateMedicationFromID, deleteMedicationFromID,
    getTimesFromMedicationID, getTimeFromTimeID} from '../controllers/controller'
import {login, register, loginRequired} from '../controllers/userControllers'

const routes = (app) => {
app.route('/medication')
   .post(loginRequired, addNewMedication)
   .get(loginRequired, getMedications);

app.route('/medication/:medicationID')
   //get a specific medication from ID
   .get(loginRequired, getMedicationFromID)
   .put(loginRequired, updateMedicationFromID)
   .delete(loginRequired, deleteMedicationFromID);

app.route('/medication/:medicationID/time')
   //get update times of a specific medication
   .get(loginRequired, getTimesFromMedicationID);
   //TODO
   //allow addition of a time

app.route('/medication/time/:timeID')
   .get(loginRequired, getTimeFromTimeID);
   //TODO
   //changes to a time
   //deletion of a time

app.route('/auth/register')
   .post(register);
   //register route

app.route('/login')
   .post(login);
   //login route
};

export default routes;