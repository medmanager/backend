import { addNewMedication, getMedications, 
    getMedicationFromID, updateMedicationFromID, deleteMedicationFromID,
    getTimesFromMedicationID, getTimeFromTimeID, fuzzySearchWithString, deleteMedications} from '../controllers/Controller'
import {login, register, loginRequired} from '../controllers/UserControllers'

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

app.route('/auth/register')
   .post(register);
   //register route

app.route('/login')
   .post(login);
   //login route

app.route('/medication/search/:searchStr')
   //currently we do not check for login
   //because search doesn't access a user's data
   .get(fuzzySearchWithString);

   // MADE FOR DEBUGGING PURPOSES
app.route('/deleteAll')
   .delete(deleteMedications);
};


export default routes;