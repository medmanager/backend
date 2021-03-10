const admin = require('firebase-admin');

//use the firebase account credentials contained in the json file
var serviceAccount = require('../../med-manager-3-firebase-adminsdk.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://med-manager-3-default-rtdb.firebaseio.com/'
});

// TODO: obtain a registration token from the application itself. The token indicates a specific app running on a specific device 
//       for firebase to send a notification out to it.
//       Link to something related to this: https://www.techotopia.com/index.php/Firebase_Cloud_Messaging#Obtaining_and_Monitoring_the_Registration_Token

var regirationToken = 'token goes here';

// small example payload to play around with firebase
var payload = {
    data: {
        key1: 'What is up my dude'
    }
};

var options = {
    priority: 'high',
    timeToLive: 60 * 60 * 24
};

admin.messaging().sendToDevice(regirationToken, payload, options)
    .then(function(response) {
        console.log("sent message: ", response);
    })
    .catch(function(error) {
        console.log('Error sending message: ', error);
    });