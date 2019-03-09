const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const PORT = process.env.PORT || 3000;
const cors = require('cors');
const bcrypt = require('bcrypt');
const { url, options } = require('./Config');
let newId = 3;

var mongoClient = require("mongodb").MongoClient;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// 
app.get("/", (req, res) => {
    res.send("Hello World.");
});

app.post("/addContainer", (req, res) => {
    let { weight, origin, destination, shipDate, arriveDate, freshness, highestBid, name } = req.body;
    newId += 1;
    let dataObj = {
        newId,
        weight,
        origin,
        destination,
        shipDate,
        arriveDate,
        freshness,
        highestBid,
        name
    }
    mongoClient.connect(url, (err, client) => {
        let containersData = client.db("data").collection("containers");
        containersData.insertOne(dataObj)
            .then(() => res.send({ status: 200, message: "success" }))
            .catch((err) => res.send({ status: 500, message: err }));
    });
});

app.post("/receiveData", (req, res) => {
    let { time, lat, long, temp, humidity, co2, containerId } = req.body;
    mongoClient.connect(url, (err, client) => {
        let dataObj = {
            id: containerId,
            time,
            lat,
            long,
            temp,
            humidity,
            co2
        }
        let readingsData = client.db("data").collection("readings");
        readingsData.updateOne({ id: containerId }, {
            $set: {
                ...dataObj
            }
        }, { upsert: true })
            .then(() => res.status(200).send(dataObj)).catch((err) => console.log(err));
    });
});


// front end APIs
app.get("/getAllContainers", (req, res) => {
    mongoClient.connect(url, (err, client) => {
        if (err) res.send({ status: 500, message: "Unable to connect to server!" });
        let containersRef = client.db("data").collection("containers");
        containersRef.find({}).toArray().then(data => {
            res.send({ containers: data });
        });
    });
});

app.get("/getReadings", (req, res) => {
    mongoClient.connect(url, (err, client) => {
        let id = req.query.id;
        if (err) res.send({ status: 500, message: "Unable to connect to server!" });
        let readingsRef = client.db("data").collection("readings");
        readingsRef.findOne({ id: id }, (err, result) => {
            if (result === null) res.send({ status: 500, message: "Unable to find data" });
            res.send(result);
        });
    });
});

app.get("/getContainer", (req, res) => {
    mongoClient.connect(url, (err, client) => {
        let id = req.query.id;
        if (err) res.send({ status: 500, message: "Unable to connect to server!" });
        let readingsRef = client.db("data");
        readingsRef.collection("containers").findOne({ id: id }, (err, result) => {
            if (err) res.send({ status: 500, message: "Unable to find data" });
            res.send(result);
        });
    });
});

app.post("/createUser", (req, res) => {
    let { name, address, phone, email, passHash } = req.body;
    let dataObj = {
        name,
        address,
        phone,
        email,
        passHash
    }
    mongoClient.connect(url, (err, client) => {
        if (err) res.send({ status: 500, message: "Unable to connect to server!" });
        let usersRef = client.db("data").collection("users");
        usersRef.insertOne(dataObj)
            .then(() => res.send({ status: 200, message: "success" }))
            .catch((err) => res.send({ status: 500, message: err }));
    });
});

app.get("/validateUser", (req, res) => {
    let { passHash, id } = req.body;
    mongoClient.connect(url, (err, client) => {
        if (err) res.send({ status: 500, message: "Unable to connect to server!" });
        let usersRef = client.db("data").collection("users");
        usersRef.findOne({ id: id }).then((data) => {
            let { passHash } = data;
        });
    });
});

app.get("/getBid", (req, res) => {
    mongoClient.connect(url, (err, client) => {
        let id = req.query.id;
        if (err) res.send({ status: 500, message: "Unable to connect to server!" });
        let readingsRef = client.db("data");
        readingsRef.collection("bids").findOne({ id: id }, (err, result) => {
            if (err) res.send({ status: 500, message: "Unable to find data" });
            res.send(result);
        });
    });
});

app.listen(PORT, () => console.log(`Launched! at port ${PORT}`));