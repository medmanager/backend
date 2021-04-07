import bodyParser from "body-parser";
import dotenv from "dotenv";
import express from "express";
import jsonwebtoken from "jsonwebtoken";
import mongoose from "mongoose";
import { initServer } from "./src";
import routes from "./src/routes/Routes";

dotenv.config({ debug: true });

const app = express();
const PORT = 4000; // to run local

// mongoose connection
mongoose.Promise = global.Promise;
mongoose.connect("mongodb://localhost/MedManagerdb", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
});

(async () => {
    // bodyparser setup
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(bodyParser.json());

    // JWT setup
    app.use((req, res, next) => {
        if (
            req.headers &&
            req.headers.authorization &&
            req.headers.authorization.split(" ")[0] === "JWT"
        ) {
            jsonwebtoken.verify(
                req.headers.authorization.split(" ")[1],
                "ATLBANANA",
                (err, user) => {
                    if (err) {
                        req.user = undefined;
                        next();
                    } else {
                        req.user = user._id;
                        next();
                    }
                }
            );
        } else {
            req.user = undefined;
            next();
        }
    });

    //when server reloads we must schedule all of the jobs for our
    await initServer();

    routes(app);

    app.listen(PORT, () => {
        //confirm server is running properly
        console.log(`server is running on port ${PORT}`);
    });
})();
