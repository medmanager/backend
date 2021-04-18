# Backend API for Med Manager 3.0

## Install Guide

### Pre-requisites

-   Install Node.js: https://nodejs.org/en/download/
-   Install MongoDB: https://docs.mongodb.com/manual/installation/
-   Install Git: https://git-scm.com/downloads

#### Setup Apple Developer Account (iOS Notifications)

In order to send out notifications to iOS devices, the backend must be setup with a verified [Apple Developer Account](https://developer.apple.com/) enrolled in the [Apple Developer Progam](https://developer.apple.com/programs/) which has a 99 USD annual fee. To setup an account, simply navigate to https://developer.apple.com and create one. You should now be presented with the dashboard. Once you are there, please follow the steps outlined below:

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

2. Go to the project settings page, and navigate to `Service Accounts` > `Generate new private key`. This json file will allow the backend to send out notifications. Place it within the root directory of this project.

3. Make sure to rename this json file to `med-manager-3-firebase-adminsdk.json`. If not changed, the backend **will not be able to send out notifications** for Android.

#### Setup Twilio Account (Caregiver Alerts)

This backend uses the Twilio API to send out text messages to caregvier contacts. In order to send out notifications, a secure Twilio account must be made. Navigate to https://twilio.com and follow the steps to create an account and create a Twilio project. From there, a dashboard screen should show the `ACCOUNT_SID` and `AUTH TOKEN` fields, which will be used to set up the environment variables in the next section. Make sure to obtain a number through the project dashboard as well, as the phone number through which text messages are sent needs to be outlined in the environment variables.

#### Set Necessary Environment Variables

**Note**: All prior steps need to be completed in order to fill out the environment variables.

In order to setup the backend enviornment properly, you must set the required environment variables through a `.env` file at the root of the project. Please follow the steps outlined below:

1. Create the file named `.env` at the root of the project.
2. Copy the contents of the `.env.example` file into the newly created `.env` file.
3. Enter the `APPLE_TEAM_ID` and `APPLE_KEY_ID` values captured in the previous section on iOS notifications setup
4. Enter the `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_PHONE_NUMBER` values captured in the previous section on caregiver alert setup.

### Download Instructions

To download the backend repository, execute the following command in a folder called `medmanager` on your machine:

```
git clone https://github.com/medmanager/backend.git
```

### Install Dependencies

To install the project's depedencies, execute the following command at the root of the backend repository:

```
npm install
```

After this command is done executing, a new folder named `node_modules` should appear at the root of the directory.

A list of dependencies for the project can be found in the `package.json` file in this repository.

### Build and Run Instructions

After installing the dependencies, to run the server locally you need to execute the following command at the root of the backend repository:

```
npm run start
```

Now you can now access the API locally at http://localhost:4000/.

**Note**: You can change the servers port number (the default is port `4000`) in the `.env` file by setting the variable like so:

```
PORT=1337
```

### Troubleshooting

TODO: write troubleshooting steps

## Release Notes

### v1.0

#### Features

-   User can now register a new account by providing their fist and last name, email, and a password.
-   User can now login to their existing account by providing their email and password. If the email or password is incorrect, an error message will be displayed.
-   User can now update their device operating system and token information via a new route.
-   User can now add a new medication to their account. The medication will be verified before the data is persisted.
-   User can now delete a medication from their account.
-   User can now update the details of a medication or reschedule it's dosages using new times or frequencies. The previous dosage data will be saved in order to track compliance over time. Of course, the information will be verified before persisting.
-   User can now stop taking a medication anytime they want. The data up until the point they stop taking the medication will be saved and continue to be used for tracking.
-   User can now resume taking a medication anytime they want. The dosages will be rescheduled and the user will now get reminders if they have enabled them in the settings.
-   Dosage reminders are now scheduled for each medication's occurrence in the current weeks time frame. The user has the ability to disable reminders on a per-dosage basis or turn off notifications entirely.
-   Dosage reminders are now persisted when the server restarts.
-   New API route which retrieves medication information along with its dosages.
-   New API route which retrieves information necessary to get all the medications for a single notification.
-   User can now access medication compliance data stored since they first added the medication.
-   User can now enable caregiver contact alerts from the settings which will be sent if the user does not take their medication within 6 hours of it's scheduled dosage time. The user can configure the name and phone number of the caregiver which will be alerted. By default, the caregiver contact will not be configured and thus, no alerts will be sent.
-   Caregiver alerts are now scheduled 6 hours after the dosage reminder is delivered to the user. If the user has disabled caregiver alerts, then nothing will be scheduled.
-   User can now configure settings to disable all notifications or to hide medication names in dosage reminders. By default, the names are hidden from the medication dosage reminders.
-   User can now update the first name, last name, or email currently associated with their account.

#### Fixes

-   The server will no longer consider duplicate occurrences when scheduling occurrences for the current week.
-   Weekly medications no longer contain incorrect occurrence times. Rescheduling a medication from daily to weekly is now possible!

#### Known Bugs and Defects

-   There is no way of resetting a users password.
-   There is no way of updating the amount of medication remaining.
-   No handling of the event when a medication has no amount remaining when taken.
-   No way of dynamically setting the JWT secret used to generate authentication tokens.
-   No assurance that the create and schedule medication occurrences successfully created and scheduled the medication occurrence.
