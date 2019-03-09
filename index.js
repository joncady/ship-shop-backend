const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const app = express();
const PORT = process.env.PORT || 3000;
const cors = require('cors');
const bcrypt = require('bcrypt');
const { url, options } = require('./Config');
let newId = 3;
let bidId = 5;
const messageUrl = "http://woodle.ngrok.io/sendSms";

var mongoClient = require("mongodb").MongoClient;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// 
app.get("/", (req, res) => {
    res.send("Hello World.");
});

// backend APIs

// adds new container (done)
app.post("/addContainer", (req, res) => {
    let { weight, origin, destination, shipDate, arriveDate, freshness, highestBid, name, fillStated, tempStated, co2Stated, humidityStated } = req.body;
    newId += 1;
    let dataObj = {
        id: String(newId),
        weight,
        origin,
        destination,
        shipDate,
        arriveDate,
        freshness,
        highestBid,
        name,
        fillStated,
        tempStated,
        co2Stated,
        humidityStated
    }
    mongoClient.connect(url, (err, client) => {
        let containersData = client.db("data").collection("containers");
        containersData.insertOne(dataObj)
            .then(() => res.send({ status: 200, message: "success" }))
            .catch((err) => res.send({ status: 500, message: err }));
    });
});

// Initiates two inserts into the database, containers and readings collection
app.post("/receiveData", (req, res) => {
    let { time, lat, long, temp, humidity, co2, containerId, fill } = req.body;
    mongoClient.connect(url, (err, client) => {
        let dataObj = {
            id: String(containerId),
            time,
            lat,
            long,
            temp,
            humidity,
            co2,
            fill
        }
        let readingsData = client.db("data").collection("readings");
        let containerData = client.db("data").collection("containers");
        readingsData.updateOne({ id: containerId }, {
            $set: {
                ...dataObj
            }
        }, { upsert: true })
            .then(() => {
                let fullOb = {
                    id: String(containerId),
                    time,
                    lat,
                    long,
                    tempActual: temp,
                    humidityActual: humidity,
                    co2Actual: co2,
                    fillActual: fill
                };
                containerData.updateOne({ id: containerId }, {
                    $set: {
                        ...fullOb
                    }
                }, { upsert: true })
                    .then(() => {
                        res.status(200).send(dataObj);
                    })
                    .catch((err) => {
                        console.log(err)
                    });
            })
            .catch((err) => console.log(err));
    });
});

// front end APIs

// get reading based on container id
app.get("/getReading", (req, res) => {
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

// gets container based on conatiner id
app.get("/getContainer", (req, res) => {
    mongoClient.connect(url, (err, client) => {
        let id = req.query.id;
        if (err) res.send({ status: 500, message: "Unable to connect to server!" });
        let containerData = client.db("data");
        containerData.collection("containers").findOne({ id: id }, (err, result) => {
            if (err) res.send({ status: 500, message: "Unable to find data" });
            res.send(result);
        });
    });
});

// returns an array of all containers
app.get("/getAllContainers", (req, res) => {
    mongoClient.connect(url, (err, client) => {
        if (err) res.send({ status: 500, message: "Unable to connect to server!" });
        let containersRef = client.db("data").collection("containers");
        containersRef.find({}).toArray().then(data => {
            res.send({ containers: data });
        });
    });
});

// creates a user
app.post("/createUser", (req, res) => {
    let { name, address, phone, email, passHash } = req.body;
    let dataObj = {
        id: newId,
        name,
        address,
        phone,
        email,
        passHash
    }
    newId += 1;
    mongoClient.connect(url, (err, client) => {
        if (err) res.send({ status: 500, message: "Unable to connect to server!" });
        let usersRef = client.db("data").collection("users");
        usersRef.insertOne(dataObj)
            .then(() => res.send({ status: 200, message: "success" }))
            .catch((err) => res.send({ status: 500, message: err }));
    });
});

// gets user based on user id
app.get("/getUser", (req, res) => {
    let id = req.query.id;
    mongoClient.connect(url, (err, client) => {
        if (err) res.send({ status: 500, message: "Unable to connect to server!" });
        let readingsRef = client.db("data").collection("users");
        readingsRef.findOne({ id: id }, (err, result) => {
            if (err) res.send({ status: 500, message: "Unable to find data" });
            res.send(result);
        });
    });
});

// validates user data (incomplete)
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

// gets bid based on bid id
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

app.get("/getAllBids", (req, res) => {
    let { containerId } = req.query;
    console.log(containerId);
    mongoClient.connect(url, (err, client) => {
        let bidRef = client.db("data").collection("bids");
        bidRef.find({ containerId: containerId }).toArray().then(data => {
            res.send({ bids: data });
        });
    });
});

// creates a bid from scratch
app.post("/createBid", (req, res) => {
    let { userId, tempDev, humidityDev, co2Dev, fillDev, reservePrice, containerId } = req.body;
    let dataObj = {
        id: String(bidId),
        userId,
        tempDev,
        humidityDev,
        co2Dev,
        fillDev,
        reservePrice,
        containerId
    }
    bidId += 1;
    mongoClient.connect(url, (err, client) => {
        if (err) res.send({ status: 500, message: "Unable to connect to server!" });
        let bidRef = client.db("data").collection("bids");
        let containerRef = client.db("data").collection("containers");
        bidRef.insertOne(dataObj, () => {
            containerRef.findOne({ id: containerId })
                .then((data) => {
                    let { currentBidId, tempActual, humidityActual, fillActual, co2Actual, tempStated, humidityStated, fillStated, co2Stated, } = data;
                    if (currentBidId) {
                        console.log("eventered");
                        bidRef.findOne({ id: currentBidId })
                            .then((data2) => {
                                let { reservePrice: oldReserve, userId: id2 } = data2;
                                if (reservePrice > oldReserve) {
                                    let tempDelta = Math.abs(tempActual - tempStated);
                                    let humidityDelta = Math.abs(humidityActual - humidityStated);
                                    let fillDelta = Math.abs(fillActual - fillStated);
                                    let co2Delta = Math.abs(co2Actual - co2Stated);
                                    console.log(tempDelta < tempDev, humidityDelta < humidityDev, fillDelta < fillDev, co2Delta < co2Dev);
                                    if (tempDelta < tempDev) {
                                        res.send({ status: 200, message: "Bid added." });
                                    } else if (humidityDelta < humidityDev) {
                                        res.send({ status: 200, message: "Bid added." });
                                    } else if (fillDelta < fillDev) {
                                        res.send({ status: 200, message: "Bid added." });
                                    } else if (co2Delta < co2Dev) {
                                        res.send({ status: 200, message: "Bid added." });
                                    } else {
                                        //gained
                                        let options1 = {
                                            method: 'POST',
                                            url: 'http://woodle.ngrok.io/sendSms',
                                            headers:
                                            {
                                                'Postman-Token': '47104849-df99-4563-b5cf-acdbdbf1a711',
                                                'cache-control': 'no-cache',
                                                'Content-Type': 'application/json'
                                            },
                                            body: {
                                                userid: userId, message: `Congratulations, you are now top bidder on the shipment of container ${containerId}. 
                                        You will be notified of any further changes. Thank you for using Ship Shop!}`
                                            },
                                            json: true
                                        };

                                        let options2 = {
                                            method: 'POST',
                                            url: 'http://woodle.ngrok.io/sendSms',
                                            headers:
                                            {
                                                'Postman-Token': '47104849-df99-4563-b5cf-acdbdbf1a711',
                                                'cache-control': 'no-cache',
                                                'Content-Type': 'application/json'
                                            },
                                            body: {
                                                userid: userId, message: `Unfortunately, the shipment in container ${containerId} exceeded bid quality parameters.
                                                Your current bid is therefore void, you may place another bid at any time before delivery. Thank you for using Ship Shop!`
                                            },
                                            json: true
                                        };
                                        request(options1, (err, res) => console.log("message 1 sent"));
                                        // lost
                                        request(options2, (err, res) => console.log("message 2 sent"));
                                        let dataObj = {
                                            currentBidId: String(bidId - 1)
                                        }
                                        containerRef.update({ id: containerId }, {
                                            $set: {
                                                ...dataObj
                                            }
                                        }).then(() => {
                                            res.send({ status: 200, message: "Bid added." });
                                        });
                                    }
                                } else {
                                    res.send({ status: 200, message: "Bid added." });
                                }
                            });
                    } else {
                        let dataObj = {
                            currentBidId: String(bidId - 1)
                        }
                        containerRef.update({ id: containerId }, {
                            $set: {
                                ...dataObj
                            }
                        }).then(() => {
                            request.post(messageUrl, {
                                body: {
                                    id: userId,
                                    message: `Congratulations, you are now top bidder on the shipment of container ${containerId}. 
                                You will be notified of any further changes. Thank you for using Ship Shop!`
                                }
                            });
                            res.send({ status: 200, message: "Bid added." });
                        });
                    }
                })
                .catch((err) => {
                    res.send({ status: 500, message: err });
                });
        });
    });
});

// replaces top bid with a new one
app.post("/topBid", (req, res) => {
    let bidId = req.body.bidId;
    let containerId = req.body.containerId;
    let dataObj = {
        currentBidId: bidId
    }
    mongoClient.connect(url, (err, client) => {
        let containersData = client.db("data").collection("containers");
        containersData.updateOne({ id: containerId }, {
            $set: {
                ...dataObj
            }
        }, { upsert: true })
            .then(() => res.send({ status: 200, message: "success" }))
            .catch((err) => res.send({ status: 500, message: err }));
    });
});

// return 

// bid made by the user
app.post("/makeBid", (req, res) => {
    let { collectionId, newBid, userId } = req.body;
    mongoClient.connect(url, (err, client) => {
        if (err) res.send({ status: 500, message: "Unable to connect to server!" });
        let bidRef = client.db("data").collection("bids");
        bidRef.findOne({ collectionId: collectionId })
            .then((data) => {
                if (!data) {
                    res.send({ status: 400, message: "Bid doesn't exist" });
                } else {
                    let oldBid = data.bid || data.reservePrice;
                    if (oldBid < newBid) {
                        let dataObj = {
                            bid: newBid,
                            usedId: userId
                        };
                        bidRef.updateOne({ id: containerId }, {
                            $set: {
                                ...dataObj
                            }
                        }, { upsert: true })
                            .then(() => res.status(200).send(dataObj))
                            .catch((err) => console.log(err));
                    }
                }
            });
    });
});

app.get("/reset", (req, res) => {
    mongoClient.connect(url, (err, client) => {
        let dataObj = {
            currentBidId: "3"
        }
        if (err) res.send({ status: 500, message: "Unable to connect to server!" });
        let containerData = client.db("data").collection("containers");
        containerData.update({ id: "666" }, {
            $set: {
                ...dataObj
            }
        })
            .then(() => res.send({ status: 200, message: "Demo reset." }))
            .catch((err) => res.send({ status: 400, message: err }));
    });
});

app.listen(PORT, () => console.log(`Launched! at port ${PORT}`));