# Backend API for Med Manager 3.0

## Install Guide

### Pre-requisites

-   Install Node.js: https://nodejs.org/en/download/
-   Install MongoDB: https://docs.mongodb.com/manual/installation/

#### Setup Apple Developer Account (iOS Notifications)

In order to send out notifications to iOS devices, the backend must be setup with a verified apple developer account. To setup an account, simply navigate to https://developer.apple.com and create one. You should now be presented with the dashboard. Once you are there, please follow the steps outlined below:

1. First, navigate to `Membership` tab and take note of the `Team ID` field. We will use this value later on.

2. Next, click on the `Certificates, IDs & Profiles` tab. Click on the `Keys` tab and click on the blue plus icon. You should be presented with a screen similar to this one:

![APN Register a New Key](/images/apn-key.png)

3. Enter a name for the key and enable the `Apple Push Notifications server (APNs)` option. Click continue and then click register.

4. Now you should be presented with the option to download the key. Please take note of the `Key ID` which will be used later on. An example is shown below:

![APN Download Key](/images/apn-download-key.png)

5. Now click on the blue download button in the top right. Save the downloaded key to the root of the backend repository and change the name of the file to `MedManager_apns_key.p8`. It's **very important** that you **change the name of the key file** otherwise the backend will not be able to send out notifications.

#### Setup Firebase Account (Android Notifications)

In order to send out notifications on devices running Android, the backend must be connected to an authenticated Firebase account. To create a Firebase account, navigate to 
https://firebase.google.com and follow the instructions. Once in the firebase console, follow these steps:

1. Create a firebase project and navigate to the project overview page. 

2. Go to the project settings page, and navigate to `Service Accounts` < `Generate new private key`. This json file will allow the backend to send out notifications. Place it within the root directory of this project.

3. Make sure to rename this json file to `med-manager-3-firebase-adminsdk.json`. If not changed, the backend will not be able to send out Firebase notifications.

#### Setup Twilio Account (Caregiver Alerts)

This backend uses the Twilio API to send out text messages to caregvier contacts. In order to send out notifications, a secure Twilio account must be made. Navigate to https://twilio.com and follow the steps to create an account and create a Twilio project. From there, a dashboard screen should show the `ACCOUNT_SID` and `AUTH TOKEN` fields, which will be used to set up the environment variables in the next section. Make sure to obtain a number through the project dashboard as well, as the phone number through which text messages are sent needs to be outlined in the environment variables.

#### Set Necessary Environment Variables

**Note**: All prior steps need to be completed in order to fill out the environment variables.

In order to setup the backend enviornment properly, you must set the required environment variables through a `.env` file at the root of the project. Please follow the steps outlined below:

1. Create the file named `.env` at the root of the project.
2. Copy the contents of the `.env.example` file into the newly created `.env` file.
3. Enter the `APPLE_TEAM_ID` and `APPLE_KEY_ID` values captured in the previous section on iOS notifications setup
4. Enter the `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_PHONE_NUMBER` values captured in the previous section on caregiver alert setup.

### Install Dependencies

To install the project's depedencies, execute the following command at the root of the backend repository:

```
npm install
```

After this command is done executing, a new folder named `node_modules` should appear at the root of the directory.

### Run Instructions

After installing the dependencies, to run the server locally you need to execute the following command at the root of the backend repository:

```
npm run start
```

Now you can now access the server locally at http://localhost:4000/.

**Note**: You can change the servers port number (the default is port `4000`) in the `.env` file by setting the variable like so:

```
PORT=1337
```

## Release Notes
